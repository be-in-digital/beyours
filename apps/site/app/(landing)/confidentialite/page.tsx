import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { COMPANY, SUBPROCESSORS, LEGAL_LAST_UPDATED } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    `Comment ${COMPANY.operatorName} (${COMPANY.legalName}), éditeur de la solution ${SITE_NAME}, collecte, utilise et protège vos données personnelles, conformément au RGPD.`,
  alternates: { canonical: "/confidentialite" },
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      subtitle={`${COMPANY.operatorName}, éditeur de ${SITE_NAME}, s'engage à protéger vos données personnelles conformément au Règlement général sur la protection des données (RGPD) et à la loi Informatique et Libertés.`}
      lastUpdated={LEGAL_LAST_UPDATED}
    >
      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement des données collectées sur ce site est{" "}
        <strong>{COMPANY.operatorName}</strong>, {COMPANY.address.street},{" "}
        {COMPANY.address.postalCode} {COMPANY.address.city}. Pour toute question
        relative à vos données, écrivez à{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2>2. Données collectées</h2>
      <p>Selon votre interaction avec le site, nous collectons :</p>
      <ul>
        <li>
          <strong>Données d&apos;identité et de contact :</strong> prénom, nom,
          adresse électronique, numéro de téléphone.
        </li>
        <li>
          <strong>Données professionnelles :</strong> nom de
          l&apos;établissement, ville, numéro SIRET.
        </li>
        <li>
          <strong>Données de commande et de paiement :</strong> offre choisie,
          montant, historique. Les données bancaires sont traitées directement
          par notre prestataire de paiement et ne sont pas conservées par nos
          soins.
        </li>
        <li>
          <strong>Données de contact commercial :</strong> le contenu des
          messages que vous nous adressez via le formulaire de contact.
        </li>
        <li>
          <strong>Données techniques :</strong> données de connexion et de
          navigation nécessaires au fonctionnement et à la sécurité du service.
        </li>
      </ul>

      <h2>3. Finalités et bases légales</h2>
      <ul>
        <li>
          <strong>Exécution du contrat :</strong> traiter votre commande, créer
          et maintenir votre Solution, gérer la facturation et le support.
        </li>
        <li>
          <strong>Respect d&apos;obligations légales :</strong> comptabilité,
          facturation, obligations fiscales.
        </li>
        <li>
          <strong>Intérêt légitime :</strong> répondre à vos demandes, améliorer
          et sécuriser le service, prévenir la fraude.
        </li>
        <li>
          <strong>Consentement :</strong> le cas échéant, communications
          commerciales, que vous pouvez retirer à tout moment.
        </li>
      </ul>

      <h2>4. Destinataires et sous-traitants</h2>
      <p>
        Vos données sont destinées aux équipes habilitées de {COMPANY.operatorName}.
        Nous faisons appel à des sous-traitants qui n&apos;interviennent que sur
        instruction et pour les finalités ci-dessus :
      </p>
      <ul>
        {SUBPROCESSORS.map((sp) => (
          <li key={sp.name}>
            <strong>{sp.name}</strong> — {sp.role} ({sp.location}).
          </li>
        ))}
      </ul>

      <h2>5. Transferts hors Union européenne</h2>
      <p>
        Certains prestataires peuvent traiter des données en dehors de
        l&apos;Union européenne. Ces transferts sont encadrés par des garanties
        appropriées (clauses contractuelles types de la Commission européenne ou
        mécanismes de décision d&apos;adéquation), assurant un niveau de
        protection équivalent.
      </p>

      <h2>6. Durées de conservation</h2>
      <ul>
        <li>
          <strong>Prospects :</strong> jusqu&apos;à trois (3) ans à compter du
          dernier contact.
        </li>
        <li>
          <strong>Clients :</strong> pendant la durée de la relation
          contractuelle.
        </li>
        <li>
          <strong>Documents comptables et factures :</strong> dix (10) ans, au
          titre des obligations légales.
        </li>
      </ul>

      <h2>7. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de
        rectification, d&apos;effacement, de limitation, d&apos;opposition et de
        portabilité de vos données, ainsi que du droit de définir des directives
        relatives à leur sort après votre décès. Vous pouvez exercer ces droits
        en écrivant à{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Vous disposez
        également du droit d&apos;introduire une réclamation auprès de la
        Commission nationale de l&apos;informatique et des libertés (CNIL,{" "}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
          www.cnil.fr
        </a>
        ).
      </p>

      <h2>8. Cookies</h2>
      <p>
        Le site utilise les cookies strictement nécessaires à son fonctionnement
        et à sa sécurité. Tout cookie de mesure d&apos;audience ou marketing, s&apos;il
        venait à être déployé, ne serait déposé qu&apos;après votre consentement,
        que vous pourrez retirer à tout moment.
      </p>

      <h2>9. Sécurité</h2>
      <p>
        {COMPANY.operatorName} met en œuvre des mesures techniques et
        organisationnelles appropriées (chiffrement des échanges, contrôle des
        accès, hébergement sécurisé) afin de protéger vos données contre tout
        accès non autorisé, perte ou altération.
      </p>

      <h2>10. Contact</h2>
      <p>
        Pour toute question relative à la présente politique ou à vos données
        personnelles :{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalPage>
  );
}
