-- RLS Policies para processing_tokens
-- A tabela ja tem RLS habilitado, mas sem policies.

-- Policy: SELECT - usuarios podem ver apenas seus proprios tokens
CREATE POLICY "Users can view their own processing tokens"
ON public.processing_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: INSERT - usuarios podem criar tokens apenas para si mesmos
CREATE POLICY "Users can create their own processing tokens"
ON public.processing_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: UPDATE - usuarios podem atualizar apenas seus proprios tokens
CREATE POLICY "Users can update their own processing tokens"
ON public.processing_tokens
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: DELETE - usuarios podem deletar apenas seus proprios tokens
CREATE POLICY "Users can delete their own processing tokens"
ON public.processing_tokens
FOR DELETE
USING (auth.uid() = user_id);
