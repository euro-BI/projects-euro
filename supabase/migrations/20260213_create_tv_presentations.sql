-- Create tv_presentations table
CREATE TABLE IF NOT EXISTS public.tv_presentations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create tv_presentation_slides table
CREATE TABLE IF NOT EXISTS public.tv_presentation_slides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presentation_id UUID REFERENCES public.tv_presentations(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    report_id TEXT NOT NULL,
    report_name TEXT,
    page_name TEXT, -- Internal Power BI page name (e.g. ReportSection...)
    page_display_name TEXT, -- Human readable page name
    duration INTEGER DEFAULT 30, -- Duration in seconds
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tv_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_presentation_slides ENABLE ROW LEVEL SECURITY;

-- Policies for tv_presentations
CREATE POLICY "Enable read access for all users" ON public.tv_presentations FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.tv_presentations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for owners or admins" ON public.tv_presentations FOR UPDATE USING (
    auth.uid() = created_by OR 
    EXISTS (SELECT 1 FROM public.projects_user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'admin_master'))
);
CREATE POLICY "Enable delete for owners or admins" ON public.tv_presentations FOR DELETE USING (
    auth.uid() = created_by OR 
    EXISTS (SELECT 1 FROM public.projects_user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'admin_master'))
);

-- Policies for tv_presentation_slides
CREATE POLICY "Enable read access for all slides" ON public.tv_presentation_slides FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.tv_presentation_slides FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for slide owners or admins" ON public.tv_presentation_slides FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.tv_presentations p 
        WHERE p.id = presentation_id AND (
            p.created_by = auth.uid() OR 
            EXISTS (SELECT 1 FROM public.projects_user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'admin_master'))
        )
    )
);
CREATE POLICY "Enable delete for slide owners or admins" ON public.tv_presentation_slides FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.tv_presentations p 
        WHERE p.id = presentation_id AND (
            p.created_by = auth.uid() OR 
            EXISTS (SELECT 1 FROM public.projects_user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'admin_master'))
        )
    )
);
