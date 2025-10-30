# Configuración de Administrador Inicial

## Problema
Después de implementar el sistema de roles (RBAC), ningún usuario puede modificar datos hasta que tenga el rol de 'admin'. Esto crea un problema de "huevo y gallina" para el primer administrador.

## Solución: Crear el Primer Administrador

### Opción 1: Usando el Backend de Lovable Cloud

1. **Acceder al Backend:**
   - Desde el panel de Lovable, haz clic en "View Backend"
   - Navega a la sección "SQL Editor" o "Table Editor"

2. **Registrar un Usuario:**
   - Ve a la página `/auth` de tu aplicación
   - Crea una cuenta con email y contraseña
   - Copia el email del usuario registrado

3. **Asignar Rol de Admin:**
   - En el backend, ejecuta la siguiente consulta SQL:
   
   ```sql
   -- Primero, encuentra el user_id del usuario
   SELECT id, email FROM auth.users WHERE email = 'tu-email@ejemplo.com';
   
   -- Luego, asigna el rol de admin (reemplaza 'USER_ID_AQUI' con el id obtenido)
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('USER_ID_AQUI', 'admin');
   ```

4. **Verificar:**
   - Cierra sesión y vuelve a iniciar sesión en tu aplicación
   - Ahora deberías tener acceso al panel de administración en `/admin`

### Opción 2: Script SQL de Bootstrap

Ejecuta este script en el backend una sola vez para configurar el primer admin:

```sql
-- Script para crear el primer administrador
-- Reemplaza 'admin@tudominio.com' con tu email real

DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Buscar el usuario por email
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'admin@tudominio.com'
  LIMIT 1;
  
  -- Si existe el usuario, asignar rol de admin
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Rol de admin asignado exitosamente al usuario %', admin_user_id;
  ELSE
    RAISE NOTICE 'Usuario no encontrado. Por favor, regístrate primero en /auth';
  END IF;
END $$;
```

## Roles Disponibles

El sistema actualmente soporta dos roles:

- **`admin`**: Puede importar libros, ejecutar comparaciones, y modificar todos los datos
- **`user`**: Solo puede ver los libros y cambios (lectura únicamente)

## Agregar Más Administradores

Una vez que tengas un administrador inicial, ese admin puede agregar más administradores ejecutando:

```sql
-- Como admin, puedes ejecutar esto para agregar más admins
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID_DEL_NUEVO_ADMIN', 'admin');
```

## Seguridad

- ✅ Solo usuarios con rol 'admin' pueden modificar libros, capítulos y párrafos
- ✅ Todos los usuarios autenticados pueden leer los datos públicos
- ✅ Las políticas RLS protegen contra escalación de privilegios
- ✅ La función `has_role()` usa SECURITY DEFINER para prevenir recursión

## Verificar Tu Rol

Para verificar tu rol actual, ejecuta en el backend:

```sql
SELECT ur.role, u.email
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.id = auth.uid();
```
