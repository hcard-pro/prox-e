// Prox-e — Fonction Netlify : Claude écrit le script des vidéos de l'onglet « Vidéos réseaux »
// Emplacement : netlify/functions/video-script.mjs
// Clé : variable d'environnement ANTHROPIC_API_KEY (configurée sur Netlify)

// Infos publiques du projet Supabase (les mêmes que dans index.html)
const SUPABASE_URL = "https://czbawdiagxttaecqyiiz.supabase.co";
const SUPABASE_KEY = "sb_publishable_XnI7TZomUQedq6Zn3I0fjw_74BlQBGd";

const json = (data, status = 200) => Response.json(data, { status });

export default async (req) => {
  if (req.method !== "POST") return json({ erreur: "Méthode non autorisée" }, 405);

  // 1. Seules les boutiques connectées peuvent utiliser Claude (protège tes crédits)
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ erreur: "Connexion requise" }, 401);
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!u.ok) return json({ erreur: "Session invalide, reconnectez-vous" }, 401);
  } catch {
    return json({ erreur: "Vérification impossible" }, 502);
  }

  // 2. Lecture de la demande
  let prompt = "";
  try {
    const corps = await req.json();
    prompt = String(corps.prompt || "").slice(0, 8000);
  } catch {
    return json({ erreur: "Requête invalide" }, 400);
  }
  if (!prompt) return json({ erreur: "Demande vide" }, 400);
  if (!process.env.ANTHROPIC_API_KEY) return json({ erreur: "Clé API non configurée" }, 500);

  // 3. Appel à Claude
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 2000,
        system: "Tu réponds uniquement avec un objet JSON valide, sans texte ni balise autour.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      console.error("Erreur API Claude :", d);
      return json({ erreur: "Service IA indisponible" }, 502);
    }
    const texte = (d.content || []).map((b) => b.text || "").join("");
    const m = texte.match(/\{[\s\S]*\}/);
    if (!m) return json({ erreur: "Réponse IA inexploitable" }, 502);
    return json({ script: JSON.parse(m[0]) });
  } catch (e) {
    console.error(e);
    return json({ erreur: "Génération impossible" }, 500);
  }
};

export const config = { path: "/api/video-script" };
