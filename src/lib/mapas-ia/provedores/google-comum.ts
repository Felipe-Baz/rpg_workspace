import type { CampoConfig } from "../tipos.ts";

export const GOOGLE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const campoGoogleKey: CampoConfig = {
  chave: "apiKey",
  rotulo: "Chave de API do Google (Gemini)",
  tipo: "segredo",
};

export const campoModelo = (padrao: string): CampoConfig => ({
  chave: "modelo",
  rotulo: "Modelo",
  tipo: "texto",
  padrao,
  ajuda: "Nomes de modelo mudam; altere aqui sem mexer no código.",
});
