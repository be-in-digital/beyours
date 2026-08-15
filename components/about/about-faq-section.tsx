"use client";

import { FaqSection } from "@/components/ui/faq-section";

const aboutFaqItems = [
  {
    question: "Combien de temps pour mettre en place la plateforme ?",
    answer:
      "Le déploiement initial prend entre 2 et 4 semaines selon la complexité de votre projet. Votre site et vos outils sont opérationnels rapidement.",
  },
  {
    question: "Est-ce que vous travaillez avec tous types de restaurants ?",
    answer:
      "Nous accompagnons les restaurants ambitieux qui veulent reprendre le contrôle de leur image digitale : restaurants traditionnels, bistrots, dark kitchens, chaînes.",
  },
  {
    question: "Y a-t-il un engagement minimum ?",
    answer:
      "Oui, un engagement d'un an est requis pour la maintenance, afin de garantir que tout fonctionne parfaitement durant la première année. Après cette période, vous êtes libre d'annuler votre abonnement — votre site continuera de fonctionner normalement. En revanche, nous ne serons plus responsables d'éventuels bugs ou dysfonctionnements qui pourraient survenir après la fin de l'accompagnement.",
  },
  {
    question: "Puis-je garder mon site actuel ?",
    answer:
      "Absolument. Si vous avez déjà un site, nous nous engageons à reproduire ou mettre à jour votre design gratuitement pour y intégrer le système BeYours. Vous conservez votre identité visuelle, on y ajoute la puissance de notre plateforme.",
  },
];

export function AboutFaqSection() {
  return (
    <FaqSection
      badge="FAQ"
      title="Questions"
      titleAccent="fréquentes"
      description="Les réponses aux questions que vous vous posez sur BeYours."
      items={aboutFaqItems}
    />
  );
}
