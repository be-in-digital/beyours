import type { Metadata } from "next";
import { LegalPage, Todo } from "@/components/legal/legal-page";
import { COMPANY, HOSTING, VAT, LEGAL_LAST_UPDATED } from "@/lib/legal";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    `Informations légales de l'éditeur du site ${SITE_NAME} — ${COMPANY.operatorName} (${COMPANY.legalName}, SAS) : identité, hébergement, propriété intellectuelle.`,
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegalesPage() {
  const capital = COMPANY.capitalEuros
    ? `${COMPANY.capitalEuros.toLocaleString("fr-FR")} €`
    : null;

  return (
    <LegalPage
      title="Mentions légales"
      subtitle={`Informations relatives à l'éditeur et à l'hébergement du site ${SITE_NAME}, conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN).`}
      lastUpdated={LEGAL_LAST_UPDATED}
    >
      <h2>1. Éditeur du site</h2>
      <p>
        Le site <strong>{SITE_URL.replace("https://", "")}</strong> et la
        solution <strong>{SITE_NAME}</strong> sont édités par :
      </p>
      <ul>
        <li>
          <strong>{COMPANY.operatorName}</strong>, nom commercial de{" "}
          {COMPANY.legalName}, {COMPANY.legalForm}
        </li>
        <li>
          Capital social : {capital ?? <Todo>montant du capital social</Todo>}
        </li>
        <li>
          Siège social : {COMPANY.address.street}, {COMPANY.address.postalCode}{" "}
          {COMPANY.address.city}, {COMPANY.address.country}
        </li>
        <li>{COMPANY.rcs}</li>
        <li>SIRET (siège) : {COMPANY.siret}</li>
        <li>
          Code APE : {COMPANY.apeCode} ({COMPANY.apeLabel})
        </li>
        <li>N° de TVA intracommunautaire : {COMPANY.vatNumber}</li>
        <li>
          Courriel :{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </li>
      </ul>
      <p>
        <strong>Marque commerciale :</strong> « {SITE_NAME} » est une marque
        exploitée par {COMPANY.operatorName}.
      </p>

      <h2>2. Directeur de la publication</h2>
      <p>
        Le directeur de la publication est le représentant légal de{" "}
        {COMPANY.operatorName} :{" "}
        {COMPANY.legalRepresentative ?? (
          <Todo>nom du représentant légal (Président)</Todo>
        )}
        .
      </p>

      <h2>3. Hébergement</h2>
      <p>
        Le backend applicatif et la base de données sont hébergés par :
      </p>
      <ul>
        <li>
          <strong>{HOSTING.backend.name}</strong>, {HOSTING.backend.address} (
          <a href={HOSTING.backend.url} target="_blank" rel="noopener noreferrer">
            {HOSTING.backend.url.replace("https://", "")}
          </a>
          )
        </li>
      </ul>
      <p>Le site (frontend) est hébergé par :</p>
      <ul>
        <li>
          {HOSTING.frontend ? (
            <>
              <strong>{HOSTING.frontend.name}</strong>,{" "}
              {HOSTING.frontend.address}
            </>
          ) : (
            <Todo>nom et adresse de l&apos;hébergeur du site</Todo>
          )}
        </li>
      </ul>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des éléments composant le site et la solution{" "}
        {SITE_NAME} (structure, code source, textes, visuels, logos, marques,
        maquettes et modèles de sites) sont la propriété exclusive de{" "}
        {COMPANY.legalName} ou de ses partenaires, et sont protégés par le droit
        de la propriété intellectuelle. Toute reproduction, représentation,
        modification ou exploitation, totale ou partielle, sans autorisation
        écrite préalable, est interdite et constitue une contrefaçon.
      </p>
      <p>
        Les modalités de licence d&apos;utilisation de la solution livrée au
        client sont précisées dans les{" "}
        <a href="/cgv">conditions générales de vente</a>.
      </p>

      <h2>5. Responsabilité</h2>
      <p>
        {COMPANY.legalName} s&apos;efforce d&apos;assurer l&apos;exactitude et la
        mise à jour des informations diffusées sur ce site, sans pouvoir en
        garantir l&apos;exhaustivité. L&apos;éditeur ne saurait être tenu
        responsable des erreurs, d&apos;une absence de disponibilité des
        informations ou de la présence de virus sur le site.
      </p>

      <h2>6. Données personnelles et cookies</h2>
      <p>
        Le traitement des données personnelles collectées via ce site est décrit
        dans notre{" "}
        <a href="/confidentialite">politique de confidentialité</a>, conforme au
        Règlement général sur la protection des données (RGPD).
      </p>

      <h2>7. TVA</h2>
      <p>{VAT.mention}.</p>
    </LegalPage>
  );
}
