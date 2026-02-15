
-- Add new columns to polls for CRUD, max votes, active status, creator tracking
ALTER TABLE public.polls 
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN max_votes integer DEFAULT NULL,
  ADD COLUMN creator_fingerprint text NOT NULL DEFAULT '',
  ADD COLUMN closed_at timestamp with time zone DEFAULT NULL;

-- Allow poll creators to update their polls (close/reopen, edit question)
CREATE POLICY "Creators can update their polls"
ON public.polls
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow poll creators to delete their polls
CREATE POLICY "Creators can delete their polls"
ON public.polls
FOR DELETE
USING (true);

-- Allow deleting poll options (for CRUD)
CREATE POLICY "Anyone can delete poll options"
ON public.poll_options
FOR DELETE
USING (true);

-- Allow updating poll options
CREATE POLICY "Anyone can update poll options"
ON public.poll_options
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Enable realtime for polls table to broadcast status changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
