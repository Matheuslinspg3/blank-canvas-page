-- Update Francisco Moraes in CRM
UPDATE public.leads 
SET 
    name = 'Francisco Moraes',
    email = 'franciscojosesantosdemoraes@gmail.com',
    external_source = 'meta_ads',
    source = 'Formulário Vídeo VILA MIRIM 1001',
    traffic_source = '[BOX][Formulário][Leads] 08/12',
    conversion_identifier = 'Formulário Vídeo VILA MIRIM 1001'
WHERE id = '6c636efd-22ce-4229-8294-b16f96c143f4';

-- Update Tiana Ferreira in CRM
UPDATE public.leads 
SET 
    name = 'Tiana Ferreira',
    email = 'giovanamodas@yahoo.com.br',
    external_source = 'meta_ads',
    source = 'Formulário Vídeo VILA MIRIM 1001',
    traffic_source = '[BOX][Formulário][Leads] 08/12',
    conversion_identifier = 'Formulário Vídeo VILA MIRIM 1001'
WHERE id = '7175af46-89fe-4cdc-b72f-557af46b8053';

-- Update the ad_leads link for Antonio Sanchez to ensure status is correct
UPDATE public.ad_leads
SET 
    status = 'sent_to_crm',
    crm_record_id = '3eb2f931-0814-4619-8ff7-8e569eb6a679'
WHERE id = '062c0496-7983-46b9-89d2-d90895ccf4a5';

-- Update the ad_leads link for Francisco Moraes
UPDATE public.ad_leads
SET 
    status = 'sent_to_crm',
    crm_record_id = '6c636efd-22ce-4229-8294-b16f96c143f4'
WHERE id = 'c7a0b83a-0883-48ac-b63c-33f56467ce87';

-- Update the ad_leads link for Tiana Ferreira
UPDATE public.ad_leads
SET 
    status = 'sent_to_crm',
    crm_record_id = '7175af46-89fe-4cdc-b72f-557af46b8053'
WHERE id = '615ecbd1-8ed0-475f-94e5-305c91742506';