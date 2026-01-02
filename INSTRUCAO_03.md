# INSTRUCAO_03 - Correções de Segurança AppSec - process-file

## Objetivo
Corrigir vulnerabilidades de segurança na Edge Function `process-file` relacionadas a validação de arquivos, limites por plano e timeout.

---

## TAREFA 1: Adicionar Constantes de Segurança e Limites por Plano

### Arquivo
`supabase/functions/process-file/index.ts`

### Localização
Após os imports (linha ~7)

### Código a ADICIONAR
```typescript
import type { SubscriptionPlan } from "../_shared/response-types.ts";

// ===== SECURITY LIMITS =====
const ABSOLUTE_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB - teto absoluto de segurança
const PROCESSING_TIMEOUT_MS = 25_000;                   // 25 segundos (margem para 50s limit)
const REQUIRED_XLSX_FILES = ["[Content_Types].xml"];    // Estrutura mínima XLSX

// Limites por plano (espelhando validate-processing)
const PLAN_LIMITS: Record<SubscriptionPlan, { maxFileSizeMB: number | null }> = {
  free: { maxFileSizeMB: 1 },
  professional: { maxFileSizeMB: 3 },
  premium: { maxFileSizeMB: null }, // ilimitado (até o teto de segurança)
};

const getMaxFileSizeForPlan = (plan: SubscriptionPlan): number => {
  const limit = PLAN_LIMITS[plan]?.maxFileSizeMB;
  if (limit === null) {
    return ABSOLUTE_MAX_FILE_SIZE_BYTES;
  }
  return limit * 1024 * 1024;
};
```

---

## TAREFA 2: Adicionar Helper de Timeout

### Arquivo
`supabase/functions/process-file/index.ts`

### Localização
Após as funções de resposta (após linha ~83)

### Código a ADICIONAR
```typescript
const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> => {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation '${operation}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};
```

---

## TAREFA 3: Adicionar Validação de Estrutura XLSX

### Arquivo
`supabase/functions/process-file/index.ts`

### Localização
Após a função `hasZipMagicBytes` (após linha ~95)

### Código a ADICIONAR
```typescript
const validateXlsxStructure = (zip: JSZip): boolean => {
  // XLSX/XLSM deve conter [Content_Types].xml na raiz
  for (const requiredFile of REQUIRED_XLSX_FILES) {
    if (!zip.file(requiredFile)) {
      return false;
    }
  }
  return true;
};
```

---

## TAREFA 4: Atualizar Mapeamento de Erros

### Arquivo
`supabase/functions/process-file/index.ts`

### Localização
Função `mapUploadError` (linhas 146-154)

### Código Atual (REMOVER)
```typescript
const mapUploadError = (message: string) => {
  if (message.includes("Missing file") || message.includes("Missing fileBase64")) {
    return { status: 400, code: "MISSING_FILE" };
  }
  if (message.includes("Unsupported content type")) {
    return { status: 415, code: "UNSUPPORTED_CONTENT_TYPE" };
  }
  return { status: 400, code: "INVALID_UPLOAD" };
};
```

### Código Corrigido (SUBSTITUIR POR)
```typescript
const mapUploadError = (message: string) => {
  if (message.includes("Missing file") || message.includes("Missing fileBase64")) {
    return { status: 400, code: "MISSING_FILE" };
  }
  if (message.includes("Unsupported content type")) {
    return { status: 415, code: "UNSUPPORTED_CONTENT_TYPE" };
  }
  if (message.includes("muito grande") || message.includes("too large")) {
    return { status: 413, code: "FILE_TOO_LARGE" };
  }
  if (message.includes("timed out")) {
    return { status: 408, code: "PROCESSING_TIMEOUT" };
  }
  return { status: 400, code: "INVALID_UPLOAD" };
};
```

---

## TAREFA 5: Modificar Função extractUpload para Aceitar Limite

### Arquivo
`supabase/functions/process-file/index.ts`

### Localização
Função `extractUpload` (linhas 116-144)

### Código Atual (REMOVER)
```typescript
const extractUpload = async (req: Request): Promise<UploadedFile> => {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Missing file");
    }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const fileName = file.name || "arquivo.xlsm";
    const mimeType = file.type || MIME_XLSM;
    return { fileBytes, fileName, mimeType };
  }

  if (contentType.includes("application/json")) {
    const raw = await req.json() as unknown;
    const payload = parseJsonPayload(raw);
    if (!payload.fileBase64) {
      throw new Error("Missing fileBase64");
    }
    const fileBytes = decodeBase64Payload(payload.fileBase64);
    const fileName = payload.fileName?.trim() || "arquivo.xlsm";
    const mimeType = payload.mimeType?.trim() || MIME_XLSM;
    return { fileBytes, fileName, mimeType };
  }

  throw new Error("Unsupported content type");
};
```

### Código Corrigido (SUBSTITUIR POR)
```typescript
const extractUpload = async (req: Request, maxFileSize: number): Promise<UploadedFile> => {
  const contentType = req.headers.get("content-type") ?? "";
  // Calcula limite base64 (base64 aumenta ~33%)
  const maxBase64Length = Math.ceil(maxFileSize * 1.4);

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Missing file");
    }

    // SECURITY: Validar tamanho ANTES de carregar na memória
    if (file.size > maxFileSize) {
      const limitMB = (maxFileSize / 1024 / 1024).toFixed(0);
      throw new Error(`Arquivo muito grande. Limite do seu plano: ${limitMB}MB`);
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const fileName = file.name || "arquivo.xlsm";
    // SECURITY: Ignorar MIME do cliente, usar sempre o esperado
    const mimeType = MIME_XLSM;
    return { fileBytes, fileName, mimeType };
  }

  if (contentType.includes("application/json")) {
    const raw = await req.json() as unknown;
    const payload = parseJsonPayload(raw);
    if (!payload.fileBase64) {
      throw new Error("Missing fileBase64");
    }

    // SECURITY: Validar tamanho do base64 ANTES de decodificar
    if (payload.fileBase64.length > maxBase64Length) {
      const limitMB = (maxFileSize / 1024 / 1024).toFixed(0);
      throw new Error(`Arquivo muito grande. Limite do seu plano: ${limitMB}MB`);
    }

    const fileBytes = decodeBase64Payload(payload.fileBase64);

    // SECURITY: Validar tamanho após decodificação (double-check)
    if (fileBytes.length > maxFileSize) {
      const limitMB = (maxFileSize / 1024 / 1024).toFixed(0);
      throw new Error(`Arquivo muito grande. Limite do seu plano: ${limitMB}MB`);
    }

    const fileName = payload.fileName?.trim() || "arquivo.xlsm";
    // SECURITY: Ignorar MIME do cliente
    const mimeType = MIME_XLSM;
    return { fileBytes, fileName, mimeType };
  }

  throw new Error("Unsupported content type");
};
```

---

## TAREFA 6: Modificar Handler Principal

### Arquivo
`supabase/functions/process-file/index.ts`

### Localização
Dentro do handler `serve()`, após autenticação (linhas ~223-240)

### Código Atual (REMOVER)
```typescript
    // AUTENTICACAO COM RLS
    const authResult = await authenticateUser(req.headers.get("Authorization"));
    if (!authResult.success) {
      return errorResponse(authResult.error, authResult.status, "UNAUTHORIZED", corsHeaders, requestId);
    }

    const { user } = authResult;
    logger.info("User authenticated", { userId: user.id });

    let upload: UploadedFile;
    try {
      upload = await extractUpload(req);
    } catch (error) {
```

### Código Corrigido (SUBSTITUIR POR)
```typescript
    // AUTENTICACAO COM RLS
    const authResult = await authenticateUser(req.headers.get("Authorization"));
    if (!authResult.success) {
      return errorResponse(authResult.error, authResult.status, "UNAUTHORIZED", corsHeaders, requestId);
    }

    const { user, supabase } = authResult;
    logger.info("User authenticated", { userId: user.id });

    // SECURITY: Consultar plano do usuário para aplicar limites corretos
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      logger.error("Failed to fetch subscription", { message: subscriptionError.message });
      return errorResponse("Erro ao verificar assinatura.", 500, "SUBSCRIPTION_ERROR", corsHeaders, requestId);
    }

    const plan: SubscriptionPlan = (subscription?.plan as SubscriptionPlan) ?? "free";
    const maxFileSize = getMaxFileSizeForPlan(plan);
    logger.info("User plan limits", { userId: user.id, plan, maxFileSizeMB: maxFileSize / 1024 / 1024 });

    let upload: UploadedFile;
    try {
      upload = await extractUpload(req, maxFileSize);
    } catch (error) {
```

---

## TAREFA 7: Adicionar Validação de Estrutura e Timeout no ZIP

### Arquivo
`supabase/functions/process-file/index.ts`

### Localização
Após carregar o ZIP (linhas ~266-278)

### Código Atual (REMOVER)
```typescript
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(upload.fileBytes);
    } catch (zipError) {
      logger.warn("Invalid ZIP file", { message: zipError instanceof Error ? zipError.message : String(zipError) });
      return errorResponse(
        "Arquivo invalido ou corrompido. Verifique se e um arquivo Excel valido (.xlsm).",
        400,
        "INVALID_ZIP",
        corsHeaders,
        requestId,
      );
    }
```

### Código Corrigido (SUBSTITUIR POR)
```typescript
    let zip: JSZip;
    try {
      // SECURITY: Timeout para evitar travamento em arquivos malformados
      zip = await withTimeout(
        JSZip.loadAsync(upload.fileBytes),
        PROCESSING_TIMEOUT_MS,
        "ZIP load"
      );
    } catch (zipError) {
      const message = zipError instanceof Error ? zipError.message : String(zipError);
      logger.warn("Invalid ZIP file or timeout", { message });

      if (message.includes("timed out")) {
        return errorResponse(
          "Tempo limite excedido ao processar arquivo.",
          408,
          "PROCESSING_TIMEOUT",
          corsHeaders,
          requestId,
        );
      }

      return errorResponse(
        "Arquivo invalido ou corrompido. Verifique se e um arquivo Excel valido (.xlsm).",
        400,
        "INVALID_ZIP",
        corsHeaders,
        requestId,
      );
    }

    // SECURITY: Validar estrutura interna do XLSX
    if (!validateXlsxStructure(zip)) {
      return errorResponse(
        "Arquivo não possui estrutura válida de Excel (.xlsm).",
        400,
        "INVALID_XLSX_STRUCTURE",
        corsHeaders,
        requestId,
      );
    }
```

---

## TAREFA 8: Adicionar Timeout na Geração do ZIP

### Arquivo
`supabase/functions/process-file/index.ts`

### Localização
Geração do output (linhas ~313-318)

### Código Atual (REMOVER)
```typescript
    const output = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
```

### Código Corrigido (SUBSTITUIR POR)
```typescript
    // SECURITY: Timeout para evitar travamento na compressão
    const output = await withTimeout(
      zip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      }),
      PROCESSING_TIMEOUT_MS,
      "ZIP generate"
    );
```

---

## Verificação Pós-Implementação

Execute os seguintes testes:

```bash
# Testar arquivo muito grande (plano free, >1MB)
# Deve retornar HTTP 413

# Testar arquivo válido (plano free, <1MB)
# Deve processar normalmente

# Testar arquivo com estrutura inválida (não é XLSX real)
# Deve retornar HTTP 400 com INVALID_XLSX_STRUCTURE

# Testar sem autenticação
# Deve retornar HTTP 401
```

### Respostas Esperadas

**Arquivo muito grande (413):**
```json
{
  "requestId": "uuid",
  "success": false,
  "error": "Arquivo muito grande. Limite do seu plano: 1MB",
  "errorCode": "FILE_TOO_LARGE"
}
```

**Estrutura inválida (400):**
```json
{
  "requestId": "uuid",
  "success": false,
  "error": "Arquivo não possui estrutura válida de Excel (.xlsm).",
  "errorCode": "INVALID_XLSX_STRUCTURE"
}
```

---

## Resumo

| # | Tarefa | Descrição |
|---|--------|-----------|
| 1 | Constantes | Adicionar limites por plano e timeout |
| 2 | Helper Timeout | Função `withTimeout` para operações críticas |
| 3 | Validação XLSX | Função `validateXlsxStructure` |
| 4 | Erros | Novos códigos FILE_TOO_LARGE e PROCESSING_TIMEOUT |
| 5 | extractUpload | Validar tamanho por plano |
| 6 | Handler | Consultar plano do usuário |
| 7 | ZIP Load | Timeout e validação de estrutura |
| 8 | ZIP Generate | Timeout na compressão |

---

## Limites por Plano

| Plano | Limite |
|-------|--------|
| free | 1 MB |
| professional | 3 MB |
| premium | 50 MB (teto de segurança) |

---

## Princípios de Segurança Aplicados

1. **Defense in Depth**: Validação em múltiplas camadas (frontend + Edge Function)
2. **Fail Secure**: Arquivos inválidos são rejeitados imediatamente
3. **Least Privilege**: Limite de tamanho por plano
4. **Input Validation**: MIME ignorado, magic bytes verificados, estrutura validada
5. **Resource Protection**: Timeout para evitar DoS
