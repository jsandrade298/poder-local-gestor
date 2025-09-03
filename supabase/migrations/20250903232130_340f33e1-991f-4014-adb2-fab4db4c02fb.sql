-- Corrigir roles dos usuários existentes para admin
UPDATE user_roles SET role = 'admin' WHERE user_id = '0cc8db70-8e1a-42a8-9802-7f56fc1d2ade';
UPDATE user_roles SET role = 'admin' WHERE user_id = 'be3dbfc3-792c-4e71-a810-cd842e2dce39';