
-- Polls table
CREATE TABLE public.polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  share_code TEXT NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) UNIQUE
);

-- Poll options table
CREATE TABLE public.poll_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

-- Votes table with fingerprint for anti-abuse
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  voter_fingerprint TEXT NOT NULL,
  voter_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(poll_id, voter_fingerprint)
);

-- Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Polls: anyone can read, anyone can create
CREATE POLICY "Anyone can view polls" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Anyone can create polls" ON public.polls FOR INSERT WITH CHECK (true);

-- Poll options: anyone can read, anyone can create
CREATE POLICY "Anyone can view poll options" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "Anyone can create poll options" ON public.poll_options FOR INSERT WITH CHECK (true);

-- Votes: anyone can read, anyone can insert (unique constraint prevents duplicates)
CREATE POLICY "Anyone can view votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Anyone can cast a vote" ON public.votes FOR INSERT WITH CHECK (true);

-- Enable realtime for votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;

-- Create index for efficient vote counting
CREATE INDEX idx_votes_option_id ON public.votes(option_id);
CREATE INDEX idx_votes_poll_id ON public.votes(poll_id);
CREATE INDEX idx_polls_share_code ON public.polls(share_code);
