# Arquitectura Técnica - Fideicomisario Leal MVP

## Visión General

Sistema de monitoreo y detección de cambios en textos de Ellen G. White (EGW Writings), diseñado para alertar a la comunidad sobre modificaciones en las publicaciones oficiales.

## Stack Tecnológico

- **Frontend**: React + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Lovable Cloud (Supabase)
- **API Externa**: EGW Writings GraphQL API
- **Comparación de Texto**: diff.js

## Arquitectura de Datos

### Base de Datos (PostgreSQL)

#### Tablas Principales

**`books`**
```sql
- id: uuid (PK)
- title: text
- code: text (código EGW, ej: "DA", "CS")
- total_changes: integer (acumulativo)
- last_check_date: timestamp
- created_at, updated_at: timestamps
```

**`chapters`**
```sql
- id: uuid (PK)
- book_id: uuid (FK -> books)
- number: integer
- title: text
- change_count: integer (acumulativo)
- created_at, updated_at: timestamps
```

**`paragraphs`**
```sql
- id: uuid (PK)
- chapter_id: uuid (FK -> chapters)
- paragraph_number: integer
- base_text: text (texto original al importar)
- latest_text: text (última versión conocida)
- has_changed: boolean
- change_history: jsonb[] (array de objetos {date, old_text, new_text})
- created_at, updated_at: timestamps
```

#### Sistema de Roles (RBAC)

**`app_role`** (ENUM)
- `admin`: Puede importar, comparar, y modificar datos
- `user`: Solo lectura

**`user_roles`**
```sql
- id: uuid (PK)
- user_id: uuid (FK -> auth.users)
- role: app_role
- created_at: timestamp
- UNIQUE(user_id, role)
```

**`has_role(user_id, role)`** (Function)
- SECURITY DEFINER para prevenir recursión RLS
- Retorna boolean si el usuario tiene el rol especificado

### Row-Level Security (RLS)

#### Políticas de Lectura (SELECT)
- ✅ Todas las tablas son públicamente legibles
- Permite que cualquier usuario vea libros y cambios

#### Políticas de Escritura (INSERT/UPDATE)
- ✅ Solo usuarios con rol `admin` pueden insertar/actualizar
- Implementado mediante `has_role(auth.uid(), 'admin')`

#### Seguridad de Roles
- ✅ Solo admins pueden asignar/modificar roles
- ✅ Usuarios pueden ver sus propios roles

## Flujo de Datos

### 1. Importación de Libros

```
Admin Page → fetchBook(code) → EGW API GraphQL
                ↓
         Normalizar datos
                ↓
         importBook(bookData)
                ↓
    Insertar: book → chapters → paragraphs
```

**Función**: `importBook()` en `src/lib/compareUtils.ts`
- Crea el registro del libro
- Itera sobre capítulos e inserta cada uno
- Inserta párrafos en batch por capítulo
- `base_text` = `latest_text` (inicialmente idénticos)

### 2. Comparación de Versiones

```
Admin Page → fetchBook(code) → Versión nueva de EGW API
                ↓
    compareBookVersion(bookId, newBookData)
                ↓
    Para cada capítulo → Para cada párrafo
                ↓
    compareParagraphs(latest_text, new_text)
                ↓
    Si cambió → Actualizar change_history
                ↓
    Acumular counts en chapter y book
```

**Función**: `compareBookVersion()` en `src/lib/compareUtils.ts`

**Características Clave**:
- ✅ Compara palabra por palabra usando `diff.diffWords()`
- ✅ Almacena historial completo en `change_history` JSONB
- ✅ **ACUMULA** contadores (no reemplaza)
- ✅ Maneja párrafos nuevos (los inserta automáticamente)
- ✅ Actualiza `last_check_date` del libro

### 3. Visualización de Cambios

```
User → Navegar a BookView
         ↓
    Cargar chapters → Filtrar changed
         ↓
    Navegar a ChapterView
         ↓
    Cargar paragraphs → Mostrar con indicador de cambio
         ↓
    Click "Ver historial"
         ↓
    DiffViewer modal → diff.diffWords()
         ↓
    Resaltar: verde (añadido) / rojo (eliminado)
```

## Componentes Frontend

### Páginas

**`/` (Index)**
- Landing page con descripción del proyecto
- Call-to-action para ver libros
- Link a autenticación y admin (si es admin)

**`/libros` (Libros)**
- Grid de libros monitoreados
- Filtro por libros con cambios
- Navegación a vista de libro individual

**`/libro/:bookId` (BookView)**
- Lista de capítulos
- Filtro por capítulos con cambios
- Estadísticas del libro

**`/capitulo/:chapterId` (ChapterView)**
- Lista de párrafos
- Componente `ParagraphItem` con indicador de cambios
- Modal `DiffViewer` para historial

**`/admin` (Admin)**
- **Protegido**: Requiere rol `admin`
- Importar nuevos libros (con validación)
- Trigger manual de comparaciones
- Lista de libros monitoreados

**`/auth` (Auth)**
- Registro de usuarios (email/password)
- Inicio de sesión
- Auto-confirm email habilitado

### Componentes Reutilizables

**`DiffViewer`**
- Modal para mostrar historial de cambios
- Usa `diff.diffWords()` para resaltado
- Verde: texto añadido
- Rojo: texto eliminado (tachado)

**`ParagraphItem`**
- Card de párrafo individual
- Indicador visual si ha cambiado
- Botón "Ver historial" (solo si tiene cambios)

**`Navbar`**
- Navegación principal
- Links a páginas públicas

## Integración con EGW API

### Endpoint
```
https://org-api.egwwritings.org/graphql
```

### Query GraphQL
```graphql
query GetBook($pubCode: String!) {
  publication(pubCode: $pubCode, lang: "es") {
    title
    pubCode
    content {
      chapter
      chapterTitle
      refcode_short
      para_count
      paragraphs {
        content
        refcode_short
      }
    }
  }
}
```

### Normalización
- Agrupa párrafos por `chapter`
- Crea estructura `EGWBook` → `EGWChapter[]` → `EGWParagraph[]`
- Maneja casos donde `chapterTitle` es null

## Algoritmo de Comparación

### Nivel de Palabra (Word-level)

```typescript
Diff.diffWords(oldText, newText)
```

Retorna array de objetos:
```typescript
{
  value: string,    // texto
  added?: boolean,  // true si es texto nuevo
  removed?: boolean // true si fue eliminado
}
```

### Almacenamiento de Cambios

```typescript
change_history: [
  {
    date: "2025-01-15T10:30:00Z",
    old_text: "texto anterior",
    new_text: "texto actualizado"
  },
  // ... más cambios
]
```

**Ventajas**:
- ✅ Historial completo preservado
- ✅ Permite auditoría temporal
- ✅ Flexible para futuros análisis

## Seguridad

### Autenticación
- ✅ Supabase Auth (email/password)
- ✅ Auto-confirm email habilitado (desarrollo)
- ✅ Session management con `onAuthStateChange`

### Autorización (RBAC)
- ✅ Función `has_role()` con SECURITY DEFINER
- ✅ RLS policies en todas las tablas
- ✅ Hook `useAdminCheck()` para verificación client-side
- ✅ Página de "Acceso No Autorizado" para no-admins

### Validación de Inputs
- ✅ Códigos de libro: solo letras mayúsculas
- ✅ Prevención de duplicados
- ✅ Sanitización de inputs en frontend

## Estado de la Implementación

### ✅ Completado (Fase 1)
- [x] Estructura de base de datos
- [x] RLS policies con RBAC
- [x] Integración con EGW API
- [x] Algoritmo de comparación
- [x] Sistema de roles admin/user
- [x] Importación de libros
- [x] Comparación manual desde admin
- [x] Visualización de cambios con diff highlighting
- [x] Manejo de párrafos nuevos
- [x] Acumulación correcta de contadores
- [x] Validación de inputs
- [x] Autenticación y autorización

### 🚧 Pendiente (Fase 2)
- [ ] Interfaz de comentarios de usuarios
- [ ] Sistema de verificación comunitaria
- [ ] Automatización de comparaciones (cron jobs)
- [ ] Notificaciones por email
- [ ] Exportación de reportes
- [ ] Dashboard de estadísticas

## Testing Manual

### Test de Seguridad RLS

```bash
# Como usuario sin rol admin
1. Registrarse en /auth
2. Intentar acceder a /admin → Debe mostrar "Acceso No Autorizado"
3. Intentar importar un libro (API call) → Debe fallar con RLS error

# Como usuario admin
1. Asignar rol admin (ver SETUP_ADMIN.md)
2. Acceder a /admin → Debe cargar correctamente
3. Importar libro "DA" → Debe funcionar
4. Ejecutar comparación → Debe funcionar
```

### Test de Comparación

```bash
1. Importar libro "DA"
2. Verificar total_changes = 0
3. Ejecutar comparación inmediata → No debe detectar cambios
4. Simular cambio manual en DB (cambiar un latest_text)
5. Ejecutar comparación con versión API → Debe detectar 1 cambio
6. Verificar que total_changes incrementó (no reemplazó)
7. Ejecutar segunda comparación → total_changes debe seguir acumulando
```

### Test de Diff Viewer

```bash
1. Navegar a un párrafo modificado
2. Click "Ver historial"
3. Verificar:
   - Texto eliminado en rojo con tachado
   - Texto añadido en verde
   - Fecha del cambio visible
```

## Rendimiento

### Optimizaciones Actuales
- Inserción de párrafos en batch
- Índices automáticos en PKs y FKs
- RLS con SECURITY DEFINER (evita recursión)

### Consideraciones Futuras
- Implementar paginación en capítulos largos
- Cache de libros frecuentemente consultados
- Índices en campos de búsqueda
- Rate limiting en API EGW

## Monitoreo y Logs

### Logs de Errores
- Console.error en catch blocks
- Toast notifications para feedback al usuario

### Recomendaciones
- Implementar logging estructurado
- Monitorear tasas de error en API EGW
- Alertas para RLS policy violations

## Deployment

### Variables de Entorno
```
VITE_SUPABASE_URL (auto-configurado)
VITE_SUPABASE_PUBLISHABLE_KEY (auto-configurado)
```

### Configuración Supabase
- Auto-confirm email: ✅ Habilitado
- Auth providers: Email/Password
- RLS: ✅ Habilitado en todas las tablas

---

## Fase 2: Sistema de Comentarios y Mejoras (Implementado)

### Nuevas Tablas

**`comments`**
```sql
- id: uuid (PK)
- chapter_id: uuid (FK -> chapters)
- paragraph_id: uuid (FK -> paragraphs, nullable)
- user_id: uuid (referencia a auth.users)
- comment_text: text
- created_at, updated_at: timestamps
```

**RLS Policies para Comments:**
- ✅ Lectura pública (todos pueden ver comentarios)
- ✅ Solo admins pueden insertar comentarios
- ✅ Solo admins pueden actualizar sus propios comentarios
- ✅ Solo admins pueden eliminar sus propios comentarios

### Campos Adicionales en `books`

```sql
- imported_at: timestamp (fecha de importación desde API)
- language: text (siempre 'es' para español)
- book_code_api: text (código usado en la API EGW)
```

### Componentes Nuevos

**`ChapterTable.tsx`**
- Tabla tabular de capítulos con número, título y contador de cambios
- Navegación directa al hacer clic en cualquier fila
- Badges visuales para cambios (rojo si hay cambios, gris si no)

**`CommentSection.tsx`**
- Interfaz de comentarios para capítulos
- CRUD completo para administradores
- Visualización de historial de comentarios
- Edición y eliminación inline
- Timestamps relativos en español

### Mejoras en Vistas Existentes

**`BookView.tsx`**
- Muestra metadata completa: código, idioma, fecha de importación
- Tabla de capítulos en lugar de tarjetas
- Formato de fechas localizado en español
- Información de cambios acumulados

**`ChapterView.tsx`**
- Integración del sistema de comentarios
- Separador visual entre párrafos y comentarios
- Acceso rápido al historial de cambios por párrafo

### Funciones Corregidas

**`update_updated_at_column()`**
- ✅ Ahora incluye `SET search_path = public` (corrige advertencia de QA)

### Modo Monolingüe (Solo Español)

- Todos los textos importados son en español
- Book code API siempre corresponde a libros en español (ej: "DTG")
- No hay selector de idioma
- Todas las fechas y mensajes están localizados en español (es-ES)

### Testing de la API EGW

Para probar la integración con la API de EGW Writings:

**Código de ejemplo: "DTG"** (El Deseado de Todas las Gentes)

```graphql
query GetBook($pubCode: String!) {
  publication(pubCode: $pubCode, lang: "es") {
    title
    pubCode
    content {
      chapter
      chapterTitle
      paragraphs {
        content
      }
    }
  }
}
```

**Variables:**
```json
{
  "pubCode": "DTG"
}
```

**Endpoint:** `https://org-api.egwwritings.org/graphql`

### Flujo de Comentarios

```
Admin en ChapterView → CommentSection
           ↓
    Escribe comentario
           ↓
    INSERT en tabla comments
           ↓
    Notificación toast
           ↓
    Recarga automática de comentarios
```

### Seguridad de Comentarios

- ✅ Solo admins autenticados pueden comentar
- ✅ Los usuarios solo pueden editar/eliminar sus propios comentarios
- ✅ Validación de permisos a nivel de RLS
- ✅ Verificación de sesión en cada operación

---

## Referencias

- [EGW Writings API](https://org-api.egwwritings.org/graphql)
- [diff.js Documentation](https://github.com/kpdecker/jsdiff)
- [Lovable Cloud Docs](https://docs.lovable.dev)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
