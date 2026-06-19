DELETE FROM whatsapp_handoffs WHERE conversa_id IN (SELECT id FROM whatsapp_conversas WHERE telefone='5599000001122');
DELETE FROM notificacoes_log WHERE payload_recebido->>'telefone'='5599000001122' OR payload_enviado->>'telefone'='5599000001122';
DELETE FROM whatsapp_conversas WHERE telefone='5599000001122';