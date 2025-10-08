import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Função para criar uma data local sem problemas de fuso horário
export function createLocalDate(dateString: string): Date {
  if (!dateString) return new Date();
  
  // Se a string já contém informação de horário, usa diretamente
  if (dateString.includes('T') || dateString.includes(' ')) {
    return new Date(dateString);
  }
  
  // Para datas no formato YYYY-MM-DD, adiciona horário local para evitar problemas de fuso
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month - 1 porque Date usa 0-11 para meses
}
