import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export const InsertTestData: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const insertSampleData = async () => {
    setLoading(true);
    
    try {
      // 1. Inserir projeto de exemplo
      console.log('Inserindo projeto de exemplo...');
      const { data: projectData, error: projectError } = await supabase
        .from('projects_projects')
        .insert([
          {
            name: 'Projeto de Teste',
            description: 'Este é um projeto de teste para verificar se a migração funcionou corretamente'
          }
        ])
        .select()
        .single();

      if (projectError) {
        console.error('Erro ao inserir projeto:', projectError);
        toast({
          title: "Erro ao inserir projeto",
          description: projectError.message,
          variant: "destructive"
        });
        return;
      }

      console.log('Projeto inserido:', projectData);

      // 2. Inserir atividade de exemplo
      console.log('Inserindo atividade de exemplo...');
      const { data: activityData, error: activityError } = await supabase
        .from('projects_activities')
        .insert([
          {
            project_id: projectData.id,
            title: 'Atividade de Teste',
            description: 'Esta é uma atividade de teste',
            status: 'Pendente',
            responsible: 'Usuário Teste'
          }
        ])
        .select()
        .single();

      if (activityError) {
        console.error('Erro ao inserir atividade:', activityError);
        toast({
          title: "Erro ao inserir atividade",
          description: activityError.message,
          variant: "destructive"
        });
        return;
      }

      console.log('Atividade inserida:', activityData);

      // 3. Inserir subatividade de exemplo
      console.log('Inserindo subatividade de exemplo...');
      const { data: subactivityData, error: subactivityError } = await supabase
        .from('projects_subactivities')
        .insert([
          {
            activity_id: activityData.id,
            title: 'Subatividade de Teste',
            status: 'Pendente',
            comment: 'Esta é uma subatividade de teste'
          }
        ])
        .select()
        .single();

      if (subactivityError) {
        console.error('Erro ao inserir subatividade:', subactivityError);
        toast({
          title: "Erro ao inserir subatividade",
          description: subactivityError.message,
          variant: "destructive"
        });
        return;
      }

      console.log('Subatividade inserida:', subactivityData);

      // 4. Inserir comentário de exemplo
      console.log('Inserindo comentário de exemplo...');
      const { data: commentData, error: commentError } = await supabase
        .from('projects_comments')
        .insert([
          {
            activity_id: activityData.id,
            author: 'Usuário Teste',
            comment: 'Este é um comentário de teste para verificar se tudo está funcionando'
          }
        ])
        .select()
        .single();

      if (commentError) {
        console.error('Erro ao inserir comentário:', commentError);
        toast({
          title: "Erro ao inserir comentário",
          description: commentError.message,
          variant: "destructive"
        });
        return;
      }

      console.log('Comentário inserido:', commentData);

      toast({
        title: "Dados de teste inseridos com sucesso!",
        description: "Projeto, atividade, subatividade e comentário foram criados.",
        variant: "default"
      });

    } catch (err) {
      console.error('Erro geral:', err);
      toast({
        title: "Erro inesperado",
        description: String(err),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const clearTestData = async () => {
    setLoading(true);
    
    try {
      // Deletar dados de teste (em ordem reversa devido às foreign keys)
      await supabase.from('projects_comments').delete().ilike('author', '%Teste%');
      await supabase.from('projects_subactivities').delete().ilike('title', '%Teste%');
      await supabase.from('projects_activities').delete().ilike('title', '%Teste%');
      await supabase.from('projects_projects').delete().ilike('name', '%Teste%');

      toast({
        title: "Dados de teste removidos",
        description: "Todos os dados de teste foram removidos.",
        variant: "default"
      });

    } catch (err) {
      console.error('Erro ao limpar dados:', err);
      toast({
        title: "Erro ao limpar dados",
        description: String(err),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto mt-4">
      <CardHeader>
        <CardTitle>Inserir Dados de Teste</CardTitle>
        <CardDescription>
          Insira dados de exemplo para testar se o carregamento de projetos está funcionando
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button onClick={insertSampleData} disabled={loading}>
            {loading ? 'Inserindo...' : 'Inserir Dados de Teste'}
          </Button>
          <Button onClick={clearTestData} disabled={loading} variant="outline">
            {loading ? 'Limpando...' : 'Limpar Dados de Teste'}
          </Button>
        </div>
        
        <div className="text-sm text-gray-600">
          <p><strong>O que será inserido:</strong></p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>1 projeto de teste</li>
            <li>1 atividade de teste</li>
            <li>1 subatividade de teste</li>
            <li>1 comentário de teste</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};