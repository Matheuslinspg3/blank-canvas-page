import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateImagePhash, hammingDistance, PHASH_DUPLICATE_THRESHOLD } from '@/lib/imagePhash';
import { generateImageVariants } from '@/lib/imageVariants';

interface UploadedImage {
  url: string;
  publicId: string;
  storageProvider?: 'r2' | 'cloudinary';
  r2KeyFull?: string;
  r2KeyThumb?: string;
  publicUrlThumb?: string;
  phash?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
}

interface DuplicateMatch {
  url: string;
  phash: string;
  property_title?: string;
  r2KeyFull?: string;
  r2KeyThumb?: string;
  storageProvider?: string;
}

// ── Presigned R2 Upload ──

interface PresignResult {
  uploadId: string;
  r2KeyFull: string;
  r2KeyThumb: string;
  presignedPutUrlFull: string;
  presignedPutUrlThumb: string;
  publicUrlFull: string;
  publicUrlThumb: string;
  requiredHeaders: Record<string, string>;
}

async function getPresignedUrls(
  propertyId: string,
  files: Array<{ mimeType: string; sizeBytes: number }>,
): Promise<PresignResult[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke('r2-presign', {
      body: { propertyId, files },
    });

    if (error || !data?.uploads) {
      console.warn('Presign failed:', error || data);
      return null;
    }

    return data.uploads;
  } catch (e) {
    console.warn('Presign request failed:', e);
    return null;
  }
}

async function uploadBlobToPresignedUrl(
  blob: Blob,
  presignedUrl: string,
  headers: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'image/webp',
      },
      body: blob,
    });

    if (!res.ok) {
      console.error(`PUT failed (${res.status}):`, await res.text().catch(() => ''));
      return false;
    }

    return true;
  } catch (e) {
    console.error('PUT to presigned URL failed:', e);
    return false;
  }
}

async function uploadToR2Proxy(
  file: File,
  propertyId: string,
): Promise<UploadedImage | null> {
  // 1. Generate thumb + full variants client-side
  let variants;
  try {
    variants = await generateImageVariants(file);
  } catch (e) {
    console.error('Variant generation failed:', e);
    return null;
  }

  // 2. Build FormData with both variants
  const fd = new FormData();
  fd.append('full', new File([variants.full.blob], 'full.webp', { type: 'image/webp' }));
  fd.append('thumb', new File([variants.thumb.blob], 'thumb.webp', { type: 'image/webp' }));
  fd.append('propertyId', propertyId);

  // 3. Upload via edge function (server-side proxy to R2)
  try {
    const { data, error } = await supabase.functions.invoke('r2-upload', {
      body: fd,
    });

    if (error || !data?.r2KeyFull) {
      console.error('R2 proxy upload failed:', error || data);
      return null;
    }

    const fullKB = (variants.full.blob.size / 1024).toFixed(0);
    const thumbKB = (variants.thumb.blob.size / 1024).toFixed(0);
    if (import.meta.env.DEV) console.log(`[R2] Proxy upload OK: full=${fullKB}KB, thumb=${thumbKB}KB, key=${data.r2KeyFull}`);

    return {
      url: data.publicUrlFull,
      publicId: data.r2KeyFull,
      storageProvider: 'r2',
      r2KeyFull: data.r2KeyFull,
      r2KeyThumb: data.r2KeyThumb,
      publicUrlThumb: data.publicUrlThumb,
    };
  } catch (e) {
    console.error('R2 proxy request failed:', e);
    return null;
  }
}

// ── Cloudinary Fallback ──

interface CloudinarySignature {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
  overwrite: boolean;
  transformation: string;
  unique_filename: boolean;
  public_id?: string;
}

async function getCloudinarySignature(folder: string, fileHash?: string): Promise<CloudinarySignature | null> {
  try {
    const { data, error } = await supabase.functions.invoke('cloudinary-sign', {
      body: { folder, file_hash: fileHash },
    });
    if (error) {
      console.error('Erro ao obter assinatura Cloudinary:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Erro ao chamar edge function Cloudinary:', error);
    return null;
  }
}

async function uploadToCloudinary(file: File, folder: string, fileHash?: string): Promise<UploadedImage | null> {
  // Import normalizer only for Cloudinary path (legacy)
  const { normalizeImageBeforeUpload, computeFileHash: computeHash } = await import('@/lib/imageNormalizer');
  const normalizedFile = await normalizeImageBeforeUpload(file);
  const hash = fileHash || await computeHash(normalizedFile);

  const signature = await getCloudinarySignature(folder, hash);
  if (!signature) return null;

  const formData = new FormData();
  formData.append('file', normalizedFile);
  formData.append('api_key', signature.api_key);
  formData.append('timestamp', signature.timestamp.toString());
  formData.append('signature', signature.signature);
  formData.append('folder', signature.folder);
  formData.append('overwrite', String(signature.overwrite));
  formData.append('transformation', signature.transformation);
  formData.append('unique_filename', String(signature.unique_filename));
  if (signature.public_id) formData.append('public_id', signature.public_id);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`,
    { method: 'POST', body: formData },
  );

  if (!response.ok) {
    let errorMsg = `Status ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData?.error?.message || JSON.stringify(errorData);
      console.error('Cloudinary upload error:', errorData);
    } catch {
      console.error('Cloudinary upload error: status', response.status);
    }
    console.error(`[UPLOAD] Cloudinary failed: ${errorMsg}`);
    return null;
  }

  const result = await response.json();
  if (import.meta.env.DEV) console.log(`[UPLOAD] Cloudinary OK: ${(result.bytes / 1024).toFixed(0)}KB stored`);

  return {
    url: result.secure_url,
    publicId: result.public_id,
    storageProvider: 'cloudinary',
  };
}

// ── pHash Duplicate Detection ──

async function findDuplicateByPhash(
  phash: string,
  organizationId: string,
  _excludePropertyId?: string,
): Promise<DuplicateMatch | null> {
  const { data: existingImages } = await supabase
    .from('property_images')
    .select(`url, phash, r2_key_full, r2_key_thumb, storage_provider, properties!inner(organization_id, title)`)
    .not('phash', 'is', null)
    .eq('properties.organization_id', organizationId);

  if (existingImages) {
    for (const img of existingImages) {
      if (img.phash && hammingDistance(phash, img.phash) <= PHASH_DUPLICATE_THRESHOLD) {
        const prop = img.properties as any;
        return {
          url: img.url,
          phash: img.phash,
          property_title: prop?.title,
          r2KeyFull: img.r2_key_full || undefined,
          r2KeyThumb: img.r2_key_thumb || undefined,
          storageProvider: img.storage_provider || undefined,
        };
      }
    }
  }

  const { data: mediaImages } = await supabase
    .from('property_media')
    .select('stored_url, original_url, phash')
    .eq('organization_id', organizationId)
    .not('phash', 'is', null);

  if (mediaImages) {
    for (const img of mediaImages) {
      if (img.phash && hammingDistance(phash, img.phash) <= PHASH_DUPLICATE_THRESHOLD) {
        return { url: img.stored_url || img.original_url, phash: img.phash };
      }
    }
  }

  return null;
}

// ── Main Hook ──

export function useImageUpload() {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [duplicatesFound, setDuplicatesFound] = useState(0);

  const uploadSingleImage = useCallback(async (
    file: File,
    folder: string = 'properties',
    options?: {
      organizationId?: string;
      skipDuplicateCheck?: boolean;
      excludePropertyId?: string;
      propertyId?: string;
    },
  ): Promise<UploadedImage | null> => {
    // Validate
    if (!file.type.startsWith('image/') && !file.name.match(/\.(heic|heif)$/i)) {
      console.warn(`[UPLOAD] Skipped non-image: ${file.name} (${file.type})`);
      return null;
    }
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      console.warn(`[UPLOAD] Skipped unsupported format: ${file.name}`);
      return null;
    }
    if (file.size > 25 * 1024 * 1024) {
      console.warn(`[UPLOAD] Skipped oversized file: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return null;
    }

    // ─── Step 1: Generate pHash for visual dedupe ───
    let phash: string | undefined;
    try {
      phash = await generateImagePhash(file);
    } catch (e) {
      console.warn('Falha ao gerar pHash:', e);
    }

    // ─── Step 2: Check pHash duplicates in DB ───
    if (phash && options?.organizationId && !options?.skipDuplicateCheck) {
      const duplicate = await findDuplicateByPhash(phash, options.organizationId, options.excludePropertyId);
      if (duplicate) {
        if (import.meta.env.DEV) console.log(`[DEDUPE] pHash match → reutilizando: ${duplicate.url}`);
        return {
          url: duplicate.url,
          publicId: '',
          isDuplicate: true,
          duplicateOf: duplicate.url,
          phash,
        };
      }
    }

    // ─── Step 3: Upload with retry (R2 primary, Cloudinary fallback) ───
    let result: UploadedImage | null = null;
    const effectivePropertyId = options?.propertyId || crypto.randomUUID();

    // Try R2 with 1 retry (only if browser supports WebP canvas or the file is already webp/jpeg/png)
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      if (attempt > 0) {
        console.log(`[UPLOAD] R2 retry #${attempt} for ${file.name}`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
      try {
        result = await uploadToR2Proxy(file, effectivePropertyId);
      } catch (e) {
        console.error(`[UPLOAD] R2 attempt ${attempt} exception:`, e);
      }
    }

    // Cloudinary fallback with 1 retry
    if (!result) {
      console.log(`[UPLOAD] R2 falhou para ${file.name}. Tentando Cloudinary como fallback...`);
      const orgFolder = options?.organizationId ? `${folder}/${options.organizationId}` : folder;
      for (let attempt = 0; attempt < 2 && !result; attempt++) {
        if (attempt > 0) {
          console.log(`[UPLOAD] Cloudinary retry #${attempt} for ${file.name}`);
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
        try {
          result = await uploadToCloudinary(file, orgFolder);
        } catch (e) {
          console.error(`[UPLOAD] Cloudinary attempt ${attempt} exception:`, e);
        }
      }
    }

    if (!result) {
      console.error(`[UPLOAD] Falha total: ${file.name} (${file.type}, ${(file.size/1024).toFixed(0)}KB)`);
      return null;
    }

    console.log(`[UPLOAD] OK via ${result.storageProvider}: ${file.name}`);
    return { ...result, phash };
  }, []);

  const uploadImage = useCallback(async (
    file: File,
    folder: string = 'properties',
    options?: {
      organizationId?: string;
      skipDuplicateCheck?: boolean;
      excludePropertyId?: string;
      propertyId?: string;
    },
  ): Promise<UploadedImage | null> => {
    setIsUploading(true);
    setUploadProgress(0);
    try {
      setUploadProgress(10);
      const result = await uploadSingleImage(file, folder, options);
      setUploadProgress(100);
      if (!result) {
        toast({ title: 'Erro no upload', description: 'Falha ao enviar imagem. Tente novamente.', variant: 'destructive' });
      }
      return result;
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({ title: 'Erro no upload', description: error.message || 'Não foi possível enviar a imagem', variant: 'destructive' });
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [uploadSingleImage, toast]);

  const uploadMultipleImages = useCallback(async (
    files: File[],
    folder: string = 'properties',
    options?: {
      organizationId?: string;
      skipDuplicateCheck?: boolean;
      excludePropertyId?: string;
      propertyId?: string;
    },
  ): Promise<UploadedImage[]> => {
    setIsUploading(true);
    setUploadProgress(0);
    setDuplicatesFound(0);

    const results: UploadedImage[] = [];
    let failed = 0;
    let dupes = 0;

    // Process in batches of 2 for stability (avoids memory pressure on mobile)
    const BATCH_SIZE = 2;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(file => uploadSingleImage(file, folder, options))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          if (result.value.isDuplicate) dupes++;
          results.push(result.value);
        } else {
          failed++;
          if (result.status === 'rejected') {
            console.error('[UPLOAD] Batch item rejected:', result.reason);
          }
        }
      }

      // Update progress based on files processed
      const processed = Math.min(i + BATCH_SIZE, files.length);
      setUploadProgress(Math.round((processed / files.length) * 100));
    }

    setIsUploading(false);
    setUploadProgress(0);

    if (dupes > 0) {
      setDuplicatesFound(dupes);
      toast({
        title: `${dupes} duplicata(s) reutilizada(s)`,
        description: 'Imagens idênticas foram reutilizadas, economizando espaço.',
      });
    }

    if (failed > 0) {
      toast({
        title: `${failed} imagem(ns) falharam`,
        description: `${results.length} de ${files.length} imagens enviadas com sucesso. As falhas podem ser reenviadas.`,
        variant: 'destructive',
      });
    } else if (results.length > 0 && failed === 0) {
      toast({
        title: `${results.length} imagem(ns) enviada(s)`,
        description: 'Todas as imagens foram enviadas com sucesso.',
      });
    }

    return results;
  }, [uploadSingleImage, toast]);

  const deleteImage = useCallback(async (publicId: string): Promise<boolean> => {
    if (import.meta.env.DEV) console.log('Imagem marcada para remoção:', publicId);
    return true;
  }, []);

  return {
    uploadImage,
    uploadMultipleImages,
    deleteImage,
    isUploading,
    uploadProgress,
    duplicatesFound,
  };
}
