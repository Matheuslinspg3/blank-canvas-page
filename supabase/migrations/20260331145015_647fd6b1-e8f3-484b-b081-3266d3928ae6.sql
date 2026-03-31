UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'audio/ogg', 'audio/ogg; codecs=opus', 'audio/mpeg', 'audio/webm', 'audio/webm; codecs=opus',
  'audio/mp4', 'audio/amr', 'audio/aac', 'audio/x-wav', 'audio/wav',
  'image/jpeg', 'image/png', 'image/webp', 
  'video/mp4'
]
WHERE id = 'whatsapp-media';