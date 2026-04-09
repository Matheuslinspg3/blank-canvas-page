UPDATE tenant_domains 
SET is_active = false, ssl_status = 'pending', verification_status = 'pending'
WHERE hostname = 'www.portocaicaraimoveis.com.br';