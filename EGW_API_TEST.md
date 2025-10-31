# Prueba de Integración con EGW Writings API

Este documento describe cómo probar la conexión con la API oficial de EGW Writings y confirmar que los libros en español se pueden importar correctamente.

## Endpoint

```
https://org-api.egwwritings.org/graphql
```

## Query GraphQL para Español

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

## Variables de Prueba

### Ejemplo 1: "DTG" (El Deseado de Todas las Gentes)

```json
{
  "pubCode": "DTG"
}
```

### Ejemplo 2: "CS" (El Conflicto de los Siglos)

```json
{
  "pubCode": "CS"
}
```

### Ejemplo 3: "PP" (Patriarcas y Profetas)

```json
{
  "pubCode": "PP"
}
```

## Probar desde la Terminal

Puedes probar la API usando `curl`:

```bash
curl -X POST https://org-api.egwwritings.org/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetBook($pubCode: String!) { publication(pubCode: $pubCode, lang: \"es\") { title pubCode content { chapter chapterTitle paragraphs { content } } } }",
    "variables": { "pubCode": "DTG" }
  }'
```

## Resultado Esperado

La respuesta debe incluir:

- `title`: Título del libro en español (ej: "El Deseado de Todas las Gentes")
- `pubCode`: Código del libro (ej: "DTG")
- `content`: Array de capítulos con sus párrafos

### Ejemplo de Respuesta Parcial

```json
{
  "data": {
    "publication": {
      "title": "El Deseado de Todas las Gentes",
      "pubCode": "DTG",
      "content": [
        {
          "chapter": 1,
          "chapterTitle": "Dios con nosotros",
          "paragraphs": [
            {
              "content": "Desde los días de la eternidad..."
            }
          ]
        }
      ]
    }
  }
}
```

## Probar desde la Aplicación

1. Inicia sesión como administrador
2. Ve a `/admin`
3. Ingresa el código "DTG" en el campo "Código del libro"
4. Haz clic en "Importar Libro"
5. Verifica que el libro se importe correctamente con metadata:
   - `imported_at`: Fecha actual
   - `language`: "es"
   - `book_code_api`: "DTG"

## Verificación en Base de Datos

Después de importar, verifica en Lovable Cloud:

```sql
SELECT 
  id,
  title,
  code,
  language,
  book_code_api,
  imported_at
FROM books
WHERE code = 'DTG';
```

Debe mostrar:
- `title`: "El Deseado de Todas las Gentes"
- `code`: "DTG"
- `language`: "es"
- `book_code_api`: "DTG"
- `imported_at`: timestamp de la importación

## Códigos de Libros Disponibles en Español

Algunos códigos comunes para libros de EGW en español:

- **DTG**: El Deseado de Todas las Gentes
- **CS**: El Conflicto de los Siglos
- **PP**: Patriarcas y Profetas
- **PR**: Profetas y Reyes
- **HAp**: Los Hechos de los Apóstoles
- **MC**: El Ministerio de Curación
- **CC**: El Camino a Cristo
- **Ed**: La Educación

## Notas Importantes

- Siempre usa `lang: "es"` en la query para obtener contenido en español
- El campo `language` en la tabla `books` se establece automáticamente en "es"
- La fecha `imported_at` se registra automáticamente al momento de la importación
- No hay soporte multiidioma en esta fase del proyecto
