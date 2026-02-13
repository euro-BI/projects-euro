import { supabase } from "@/integrations/supabase/client";

export interface TVPresentation {
  id: string;
  name: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TVPresentationSlide {
  id: string;
  presentation_id: string;
  workspace_id: string;
  report_id: string;
  report_name: string;
  embed_url: string;
  page_name: string;
  page_display_name: string;
  duration: number;
  order_index: number;
  created_at: string;
}

export const tvPresentationService = {
  async listPresentations(onlyActive: boolean = false) {
    let query = supabase
      .from("tv_presentations")
      .select("*")
      .order("created_at", { ascending: false });

    if (onlyActive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as TVPresentation[];
  },

  async getPresentation(id: string) {
    const { data, error } = await supabase
      .from("tv_presentations")
      .select("*, tv_presentation_slides(*)")
      .eq("id", id)
      .order("order_index", { foreignTable: "tv_presentation_slides", ascending: true })
      .single();

    if (error) throw error;
    return data as TVPresentation & { tv_presentation_slides: TVPresentationSlide[] };
  },

  async createPresentation(name: string, createdBy: string, isActive: boolean = true) {
    const { data, error } = await supabase
      .from("tv_presentations")
      .insert({ name, created_by: createdBy, is_active: isActive })
      .select()
      .single();

    if (error) throw error;
    return data as TVPresentation;
  },

  async updatePresentation(id: string, name: string, isActive?: boolean) {
    const updateData: any = { 
      name, 
      updated_at: new Date().toISOString() 
    };
    
    if (isActive !== undefined) {
      updateData.is_active = isActive;
    }

    const { data, error } = await supabase
      .from("tv_presentations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as TVPresentation;
  },

  async deletePresentation(id: string) {
    const { error } = await supabase
      .from("tv_presentations")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async addSlide(slide: Omit<TVPresentationSlide, "id" | "created_at">) {
    const { data, error } = await supabase
      .from("tv_presentation_slides")
      .insert(slide)
      .select()
      .single();

    if (error) throw error;
    return data as TVPresentationSlide;
  },

  async updateSlide(id: string, slide: Partial<TVPresentationSlide>) {
    const { data, error } = await supabase
      .from("tv_presentation_slides")
      .update(slide)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as TVPresentationSlide;
  },

  async deleteSlide(id: string) {
    const { error } = await supabase
      .from("tv_presentation_slides")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async reorderSlides(presentationId: string, slideIds: string[]) {
    const updates = slideIds.map((id, index) => 
      supabase
        .from("tv_presentation_slides")
        .update({ order_index: index })
        .eq("id", id)
    );

    const results = await Promise.all(updates);
    const firstError = results.find(r => r.error);
    if (firstError) throw firstError.error;
  }
};
