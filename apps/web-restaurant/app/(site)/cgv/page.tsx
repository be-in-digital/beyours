import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { COMPANY, VAT, LEGAL_LAST_UPDATED } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Conditions générales de vente — Be in Digital",
  description:
    "Conditions générales de vente de la solution Be in Digital : création du site, maintenance annuelle, paiement, propriété intellectuelle, garanties.",
  alternates: { canonical: "/cgv" },
};

export default function CgvPage() {
  return (
    <LegalPage
      title="Conditions générales de vente"
      subtitle={`Les présentes conditions régissent la vente de la solution ${SITE_NAME}, éditée par ${COMPANY.legalName}, à ses clients professionnels et consommateurs.`}
      lastUpdated={LEGAL_LAST_UPDATED}
    >
      <h2>1. Objet et champ d&apos;application</h2>
      <p>
        Les présentes conditions générales de vente (les « CGV ») régissent
        l&apos;ensemble des relations entre {COMPANY.legalName} (le
        « Prestataire ») et toute personne physique ou morale passant commande
        de la solution {SITE_NAME} (le « Client »). Toute commande implique
        l&apos;acceptation sans réserve des présentes CGV, qui prévalent sur tout
        autre document du Client.
      </p>

      <h2>2. Définitions</h2>
      <ul>
        <li>
          <strong>Solution :</strong> le site web de commande en ligne, le
          back-office de gestion et les modules associés fournis par le
          Prestataire sous la marque {SITE_NAME}.
        </li>
        <li>
          <strong>Création :</strong> la prestation initiale de conception,
          paramétrage et mise en ligne de la Solution, facturée en une fois.
        </li>
        <li>
          <strong>Maintenance :</strong> l&apos;abonnement récurrent couvrant
          l&apos;hébergement, les mises à jour, la supervision et le support.
        </li>
      </ul>

      <h2>3. Offres, prix et TVA</h2>
      <p>
        L&apos;offre comprend une prestation de <strong>Création</strong> réglée
        en une fois, puis un abonnement de <strong>Maintenance annuelle</strong>{" "}
        reconductible. Les prix applicables sont ceux affichés sur la page{" "}
        <a href="/tarifs">Tarifs</a> et rappelés dans le récapitulatif de
        commande au moment du paiement. La première période de maintenance est
        incluse dans le paiement initial.
      </p>
      <p>
        Les prix sont indiqués <strong>hors taxes (HT)</strong>. Conformément au
        régime applicable au Prestataire : <strong>{VAT.mention}</strong>. Toute
        évolution du taux ou du régime de TVA pourra être répercutée sur les prix
        à compter de son entrée en vigueur.
      </p>
      <p>
        <strong>Offre fondateurs :</strong> les dix (10) premières prestations
        de Création de l&apos;offre Essentielle bénéficient d&apos;un tarif
        préférentiel, en contrepartie d&apos;engagements du Client (étude de cas,
        témoignage, droit de référence). Cette offre s&apos;éteint par épuisement
        des places et n&apos;est pas cumulable avec le parrainage.
      </p>

      <h2>4. Commande</h2>
      <p>
        La commande est passée en ligne. Le Client renseigne ses informations
        (établissement, ville, et, pour un professionnel, numéro SIRET), vérifie
        le récapitulatif, puis procède au paiement. La vente est parfaite à
        réception de la confirmation de paiement. Un courriel de confirmation est
        adressé au Client.
      </p>

      <h2>5. Paiement</h2>
      <p>
        Le paiement s&apos;effectue en ligne par carte bancaire, ou en plusieurs
        fois via nos partenaires de paiement fractionné (Alma, et Klarna pour les
        consommateurs). Les paiements sont opérés par le prestataire Stripe dans
        un environnement sécurisé ; le Prestataire n&apos;a jamais accès aux
        données complètes de la carte.
      </p>
      <p>
        La Maintenance est prélevée par abonnement récurrent selon la périodicité
        choisie (mensuelle ou annuelle). En cas d&apos;échec de paiement, le
        Prestataire pourra suspendre la Solution après information du Client et
        relances restées sans effet.
      </p>

      <h2>6. Création et livraison</h2>
      <p>
        La prestation de Création débute après réception du paiement et des
        éléments nécessaires transmis par le Client (contenus, visuels, accès).
        Les délais de mise en ligne sont communiqués à titre indicatif et
        dépendent de la fourniture de ces éléments. Le Client dispose d&apos;un
        délai de vérification pour signaler toute non-conformité à la mise en
        ligne.
      </p>

      <h2>7. Obligations du Client</h2>
      <p>Le Client s&apos;engage à :</p>
      <ul>
        <li>
          fournir des informations exactes et les contenus nécessaires à la
          Création, dont il garantit détenir les droits ;
        </li>
        <li>
          utiliser la Solution conformément à sa destination et à la
          réglementation applicable à son activité ;
        </li>
        <li>
          préserver la confidentialité de ses identifiants d&apos;accès au
          back-office.
        </li>
      </ul>

      <h2>8. Maintenance et renouvellement</h2>
      <p>
        La Maintenance est conclue pour une durée d&apos;un (1) an, incluse dans
        le paiement initial, puis <strong>reconduite tacitement</strong> par
        périodes successives d&apos;un an, sauf résiliation. Conformément à
        l&apos;article L. 215-1 du Code de la consommation, le consommateur est
        informé par écrit, au plus tôt trois mois et au plus tard un mois avant
        le terme, de sa faculté de ne pas reconduire.
      </p>
      <p>
        Le Client peut résilier la Maintenance à tout moment, avec effet à
        l&apos;échéance de la période en cours, depuis son espace ou par courriel
        à <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Les sommes déjà
        réglées pour la période en cours restent acquises. La prestation de
        Création, réglée en une fois, n&apos;est pas remboursable une fois la
        Solution livrée.
      </p>

      <h2>9. Propriété intellectuelle et licence</h2>
      <p>
        Le code source, les modèles, l&apos;architecture technique et la marque{" "}
        {SITE_NAME} demeurent la propriété exclusive du Prestataire. Le Prestataire
        concède au Client, pour la durée de la Maintenance, une licence
        d&apos;utilisation personnelle et non exclusive de la Solution pour son
        activité. Les contenus fournis par le Client (textes, photos, logo)
        restent sa propriété.
      </p>

      <h2>10. Données personnelles</h2>
      <p>
        Les traitements de données personnelles sont décrits dans la{" "}
        <a href="/confidentialite">politique de confidentialité</a>. Lorsque le
        Prestataire traite, pour le compte du Client, des données de la clientèle
        de ce dernier, il agit en qualité de sous-traitant au sens du RGPD, dans
        les conditions prévues au contrat.
      </p>

      <h2>11. Garanties et responsabilité</h2>
      <p>
        Le Prestataire est tenu, à l&apos;égard du consommateur, de la garantie
        légale de conformité (art. L. 217-3 et suivants du Code de la
        consommation) et de la garantie des vices cachés (art. 1641 et suivants
        du Code civil). Le Prestataire met en œuvre les moyens nécessaires au bon
        fonctionnement de la Solution.
      </p>
      <p>
        Sauf faute lourde ou dommage corporel, et dans la limite autorisée par la
        loi, la responsabilité du Prestataire au titre du contrat est limitée aux
        montants effectivement réglés par le Client au cours des douze (12)
        derniers mois. Le Prestataire n&apos;est pas responsable des dommages
        indirects (perte d&apos;exploitation, de chiffre d&apos;affaires ou de
        données imputable au Client).
      </p>

      <h2>12. Droit de rétractation</h2>
      <p>
        <strong>Client professionnel :</strong> la commande étant conclue aux
        fins de son activité, le droit de rétractation prévu par le Code de la
        consommation ne s&apos;applique pas.
      </p>
      <p>
        <strong>Client consommateur :</strong> vous disposez en principe
        d&apos;un délai de quatorze (14) jours pour vous rétracter. Toutefois, en
        demandant l&apos;exécution de la prestation de Création avant la fin de ce
        délai, vous reconnaissez, conformément à l&apos;article L. 221-28 du Code
        de la consommation, renoncer à votre droit de rétractation une fois la
        prestation pleinement exécutée.
      </p>

      <h2>13. Force majeure</h2>
      <p>
        La responsabilité du Prestataire ne saurait être engagée en cas
        d&apos;inexécution due à un événement de force majeure au sens de
        l&apos;article 1218 du Code civil.
      </p>

      <h2>14. Réclamations et médiation</h2>
      <p>
        Toute réclamation peut être adressée à{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Conformément aux
        articles L. 612-1 et suivants du Code de la consommation, le consommateur
        peut recourir gratuitement à un médiateur de la consommation en vue de la
        résolution amiable de tout litige. Les coordonnées du médiateur compétent
        sont communiquées au consommateur sur simple demande. Le consommateur peut
        également utiliser la plateforme européenne de règlement en ligne des
        litiges.
      </p>

      <h2>15. Droit applicable et litiges</h2>
      <p>
        Les présentes CGV sont soumises au droit français. À défaut de résolution
        amiable, tout litige relève des tribunaux français compétents dans les
        conditions du droit commun.
      </p>
    </LegalPage>
  );
}
