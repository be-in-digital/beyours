/**
 * Canonical text of the affiliate (apporteur d'affaires) contract (v1.0), under
 * version control. Loaded and activated through
 * `contractVersions.publishApporteurContract`.
 *
 * Rendered as plain text (`whitespace-pre-wrap`) on /parrainage/contrat: no
 * Markdown, structure comes from numbered ARTICLES and blank lines.
 *
 * Consistent with the « points clés » shown on the signature page (500 € per
 * signed client at the scale in force, paid after a 14-day validation period;
 * independent intermediary; no collection of funds on behalf of the company;
 * attribution through a referral link/code; timestamped simple electronic
 * signature).
 *
 * Hardened after an expert-panel audit (contract law, tax / social security,
 * contract<->code consistency) on 2026-07-20:
 *  - the programme is reserved for PROFESSIONALS (SIREN), which takes it out of
 *    consumer law and secures DAS2 (art. 240 CGI) + URSSAF joint liability;
 *  - honest payment deadline (a validation period, not a firm deadline the code
 *    does not honour);
 *  - amount = the scale in force on the order date (not a hard-coded « 500 € »),
 *    never revised downwards for sales already attributed;
 *  - anti-potestativity (good faith + dated objective criteria);
 *  - VAT: flat amount inclusive of tax (optimal under franchise en base, see
 *    company.ts VAT);
 *  - 12-month non-circumvention, France territoriality + withholding under art.
 *    182 B, art. 11 with no tacit acceptance (express re-signature required),
 *    jurisdiction split between merchants and others.
 * The clawback clause (art. 4.3) remains a RIGHT of the company; enforcing it
 * automatically (refund/chargeback webhooks + Stripe reversal) is a separate
 * piece of work, still to be wired up.
 */

export const APPORTEUR_CONTRACT_TITLE = "Contrat d'apporteur d'affaires";

export const APPORTEUR_CONTRACT_CONTENT = `CONTRAT D'APPORTEUR D'AFFAIRES

ENTRE LES SOUSSIGNÉS :

La société TUUM AGENCY, société par actions simplifiée, dont le siège social est situé 229 rue Saint-Honoré, 75001 Paris, immatriculée au Registre du commerce et des sociétés de Paris sous le numéro 930 817 697, représentée par son représentant légal dûment habilité, exploitant la marque commerciale « Be in Digital »,
ci-après dénommée « la Société »,

D'UNE PART,

ET :

L'apporteur d'affaires, personne physique ou morale déclarant agir dans le cadre d'une activité professionnelle indépendante et disposant à ce titre d'un numéro d'identification (SIREN/SIRET) qu'il renseigne, identifié par les informations de son compte et les coordonnées (nom, adresse postale, téléphone, numéro d'identification) renseignées lors de la signature du présent contrat,
ci-après dénommé « l'Apporteur »,

D'AUTRE PART,

ci-après ensemble « les Parties ».

PRÉAMBULE

La Société édite et commercialise « BeYours », une solution digitale destinée aux restaurateurs (création d'un site de commande en ligne et de son back-office, puis maintenance annuelle). L'Apporteur, agissant dans le cadre d'une activité professionnelle indépendante, souhaite présenter à la Société des prospects susceptibles de souscrire à ses offres, en contrepartie d'une commission, dans le cadre d'une simple mise en relation, sans mandat de représentation ni de négociation. Le programme est réservé aux personnes agissant à titre professionnel. C'est dans ce contexte que les Parties ont convenu ce qui suit.


ARTICLE 1. OBJET

1.1. L'Apporteur a pour mission de signaler et de présenter à la Société des prospects (restaurateurs) susceptibles de souscrire aux offres de la Société, au moyen d'un lien et d'un code de parrainage personnels mis à sa disposition.

1.2. La mission de l'Apporteur se limite à une mise en relation. L'Apporteur ne dispose d'aucun pouvoir de représentation, de négociation, d'engagement, de conclusion, de signature, de facturation ni d'encaissement au nom et pour le compte de la Société. Il ne peut fixer aucun prix, consentir aucune remise, ni prendre aucun engagement au nom de la Société.

1.3. La Société demeure seule décisionnaire de l'acceptation ou du refus de tout prospect, du contenu de ses offres et de la conclusion ou non d'une vente. Elle exerce ce pouvoir d'appréciation de bonne foi et ne saurait en détourner l'usage dans le seul but de priver l'Apporteur d'une commission afférente à une vente effectivement réalisée grâce à son apport.


ARTICLE 2. INDÉPENDANCE DES PARTIES

2.1. L'Apporteur agit en qualité de professionnel indépendant. Le présent contrat n'emporte aucun lien de subordination, aucun contrat de travail, aucune société créée de fait, aucune société en participation ni aucun mandat d'intérêt commun entre les Parties. Chaque Partie supporte ses propres charges, cotisations et impôts.

2.2. Absence d'exclusivité. La Société reste libre de commercialiser ses offres directement ou par tout autre canal ou apporteur, sans que l'Apporteur puisse prétendre à une quelconque somme au titre de ventes qui ne lui sont pas attribuables. L'Apporteur reste libre d'exercer toute autre activité, sous réserve de loyauté.

2.3. Statut et immatriculation. L'Apporteur déclare et garantit exercer son activité de manière autonome et régulière. Il s'oblige à disposer d'une immatriculation régulière (notamment micro-entreprise, société ou tout statut l'autorisant à percevoir une rémunération d'apport d'affaires) et à en communiquer les références (numéro SIREN/SIRET) ainsi qu'une adresse complète à la Société. Aucune commission ne peut être versée tant que ces informations n'ont pas été fournies ; à défaut, la Société peut suspendre ou refuser le versement sans que sa responsabilité puisse être engagée. L'Apporteur demeure seul redevable de ses cotisations et contributions sociales et fiscales, et garantit intégralement la Société contre toute réclamation, redressement ou sanction (notamment au titre des articles L. 8221-1 et suivants du Code du travail) résultant de sa propre situation.

2.4. Exécution effective. La qualification du présent contrat résulte de son exécution effective. L'Apporteur s'interdit en conséquence tout acte de négociation des prix, conditions ou volumes, toute relance commerciale au nom de la Société et tout acte tendant à provoquer la conclusion d'une vente au-delà de la simple mise en relation. Tout manquement caractérisé à la présente stipulation constitue un manquement grave au sens de l'article 10.2.

2.5. Territorialité. Le programme est réservé aux Apporteurs établis en France. La Société peut refuser ou ne pas verser de commission à un Apporteur établi hors de France. Si une commission devait néanmoins être versée à un Apporteur non-résident, la Société pourra appliquer toute retenue à la source légalement due (notamment article 182 B du Code général des impôts, sous réserve des conventions fiscales applicables), le montant versé étant réduit à due concurrence.


ARTICLE 3. COMMISSION

3.1. Montant. La Société verse à l'Apporteur une commission par Nouveau Client apporté et effectivement converti, dont le montant est celui en vigueur au jour de la commande selon les conditions du programme. À la date de signature du présent contrat, ce montant est de cinq cents euros (500 €) par Nouveau Client. Le montant applicable à une vente donnée est celui figurant au décompte de l'Apporteur (article 4.4) et ne peut être révisé à la baisse pour les ventes déjà attribuées.

3.2. Nouveau Client. Est un « Nouveau Client » le prospect qui, cumulativement : (i) n'était pas déjà client de la Société ni en relation commerciale active avec elle, ce que la Société apprécie de bonne foi au regard d'éléments objectifs et datés antérieurs à la présentation par l'Apporteur (échanges écrits, enregistrement horodaté, devis émis) ; (ii) souscrit une prestation de création ; et (iii) dont le paiement initial est intégralement et définitivement encaissé par la Société et non contesté. La qualité de Nouveau Client est appréciée par la Société au regard de ses fichiers et de son historique commercial ; en cas de doublon ou de client déjà connu, la Société peut écarter la commission, y compris après versement (article 4.3).

3.3. Attribution. La commission n'est due que si la vente est attribuable à l'Apporteur par l'utilisation effective de son lien ou code de parrainage lors de la commande. En présence de plusieurs codes, seul le code effectivement appliqué au paiement est retenu. L'auto-parrainage direct (commande passée avec la même adresse électronique que l'Apporteur) est automatiquement écarté ; plus largement, aucune commission n'est due lorsque le client est l'Apporteur lui-même ou une personne ou entité qui lui est liée, la Société pouvant refuser ou reprendre toute commission dont il apparaît qu'elle procède d'une telle opération.

3.4. Caractère forfaitaire et unique. La commission est due une seule fois par Nouveau Client, quel que soit le montant ou l'offre souscrite, à l'exclusion de toute autre somme. Elle n'ouvre droit à aucune commission sur les renouvellements de maintenance, les abonnements récurrents, les achats ultérieurs, les prestations additionnelles, ni sur les commandes portant sur d'autres établissements du même client.

3.5. Montant forfaitaire, toutes taxes comprises. La commission constitue un montant forfaitaire, global et définitif, toutes taxes et charges comprises. Il ne peut donner lieu à aucun supplément, quel que soit le statut fiscal ou social de l'Apporteur. Si l'Apporteur est assujetti à la TVA, celle-ci est réputée incluse dans le montant : la Société verse le montant convenu au total, à charge pour l'Apporteur d'en reverser la TVA à l'administration ; en aucun cas la TVA ne s'ajoute au forfait. Chaque Partie conserve à sa charge ses propres impôts, taxes et cotisations.

3.6. La simple présentation d'un prospect, comme une vente non conclue ou refusée par la Société, n'ouvre droit à aucune commission ni indemnité.

3.7. Informations fiscales. L'Apporteur fournit et maintient à jour les informations nécessaires à la Société pour satisfaire ses obligations déclaratives, notamment la déclaration des commissions versées prévue à l'article 240 du Code général des impôts : nom et prénom ou raison sociale, adresse postale complète, numéro SIREN/SIRET et, s'il y est assujetti, numéro de TVA intracommunautaire. L'Apporteur autorise la Société à mentionner dans ses déclarations les sommes qui lui sont versées. La Société peut suspendre tout versement tant que ces informations ne lui ont pas été communiquées.


ARTICLE 4. MODALITÉS DE VERSEMENT

4.1. Exigibilité. La commission devient exigible à la date d'encaissement définitif du paiement initial du Nouveau Client.

4.2. Facturation et versement. La commission est versée après une période de validation de quatorze (14) jours à compter de l'encaissement définitif, destinée à couvrir tout risque d'annulation ou de remboursement. Passé ce délai et sous réserve que la vente demeure acquise, le versement est traité lors du cycle de paiement suivant (à titre indicatif, dans un délai d'environ quinze (15) jours), par l'intermédiaire du prestataire de paiement de la Société (Stripe Connect), sur le compte configuré et validé par l'Apporteur. Le versement est subordonné à la validation du compte de paiement de l'Apporteur (procédure d'identification du prestataire) et, l'Apporteur agissant à titre professionnel, à l'émission préalable d'une facture conforme mentionnant son identité, son adresse, son numéro SIREN/SIRET, la date, un numéro de facture, la description (« commission d'apport d'affaires »), le montant et la mention de TVA applicable à son statut. La Société peut différer tout versement jusqu'à réception d'une facture conforme et des informations requises.

4.3. Reversement (annulation, impayé, remboursement). En cas d'annulation, de rétractation, de remboursement, d'impayé, de rejet ou de rétrofacturation (chargeback) affectant la vente correspondante, la commission n'est pas due. Si elle a déjà été versée, l'Apporteur s'engage à la restituer sans délai, la Société pouvant, à son choix, la compenser avec toute commission future.

4.4. Décompte. L'Apporteur peut consulter l'état de ses commissions dans son espace. Toute contestation d'un décompte doit être formulée dans les trente (30) jours ; à défaut, le décompte est réputé accepté.


ARTICLE 5. OBLIGATIONS DE L'APPORTEUR

5.1. L'Apporteur présente la Société et ses offres de manière loyale, honnête et exacte. Il s'interdit toute promesse, garantie, tarif, délai ou engagement qui n'aurait pas été validé par la Société.

5.2. L'Apporteur n'utilise que les éléments de marque et supports fournis ou expressément autorisés par la Société. Il s'interdit d'altérer la marque « Be in Digital », de déposer ou d'exploiter un nom de domaine, une marque, un compte ou un signe reprenant ou imitant ceux de la Société, et d'enchérir sur la marque de la Société en publicité en ligne, sauf accord écrit préalable.

5.3. Protection des données et prospection. L'Apporteur ne collecte et ne transmet des données de prospects que de manière licite, loyale et transparente, dans le respect du Règlement général sur la protection des données (RGPD) et des règles applicables à la prospection (notamment la LCEN). Toute prospection non sollicitée illicite et tout envoi non consenti sont proscrits. L'Apporteur garantit la Société contre toute réclamation, sanction ou dommage résultant d'un manquement de sa part à ce titre.

5.4. L'Apporteur s'interdit tout dénigrement de la Société comme de ses concurrents, et de se présenter comme salarié, mandataire, agent ou représentant de la Société.

5.5. Non-contournement. L'Apporteur s'interdit, pendant la durée du contrat et pendant douze (12) mois après son terme, de contourner la Société pour traiter directement, ou d'orienter vers un concurrent de la Société, un prospect présenté dans le cadre du programme.


ARTICLE 6. CONFIDENTIALITÉ

Chaque Partie s'engage à conserver confidentielles les informations non publiques dont elle a connaissance à l'occasion du contrat (notamment conditions commerciales particulières, fichiers, méthodes et données). Cet engagement s'applique pendant toute la durée du contrat et pendant trois (3) ans après son terme.


ARTICLE 7. PROPRIÉTÉ INTELLECTUELLE

La marque « Be in Digital », les supports, contenus, visuels et outils fournis à l'Apporteur demeurent la propriété exclusive de la Société. La Société concède à l'Apporteur, pour la seule durée du contrat et les seuls besoins de sa mission, un droit d'usage personnel, non exclusif et non cessible, révocable à tout moment.


ARTICLE 8. DONNÉES PERSONNELLES

Chaque Partie respecte la réglementation applicable aux données personnelles. Le traitement des données par la Société est décrit dans sa politique de confidentialité. L'Apporteur demeure responsable des traitements qu'il met en œuvre pour ses propres prospects jusqu'à leur transmission à la Société.


ARTICLE 9. RESPONSABILITÉ

9.1. L'Apporteur répond de ses fautes et manquements et en garantit la Société.

9.2. La responsabilité de la Société envers l'Apporteur, au titre du présent contrat, est limitée au montant des commissions effectivement dues et non encore versées. Sont exclus les dommages indirects (notamment perte de chance, de gain ou de chiffre d'affaires).


ARTICLE 10. DURÉE ET RÉSILIATION

10.1. Durée. Le contrat est conclu pour une durée indéterminée à compter de sa signature.

10.2. Résiliation. Chaque Partie peut y mettre fin à tout moment, sans motif, moyennant un préavis de trente (30) jours notifié par écrit (y compris par courriel). En cas de manquement grave (notamment fraude, atteinte à la marque, violation du RGPD, dénigrement ou fausse déclaration), la Société peut résilier avec effet immédiat, sans préavis ni indemnité.

10.3. Absence d'indemnité de fin de contrat. Les Parties reconnaissent expressément que l'Apporteur n'a pas la qualité d'agent commercial au sens des articles L. 134-1 et suivants du Code de commerce, qu'il n'exerce aucun pouvoir de négociation ni de conclusion, et qu'aucune indemnité de cessation de contrat, de clientèle, ni aucun préavis autre que celui prévu à l'article 10.2 ne sont dus.

10.4. Sort des commissions. Seules restent dues, après la résiliation, les commissions afférentes aux ventes déjà définitivement conclues et encaissées avant la date d'effet de la résiliation. Aucune commission n'est due au titre de ventes postérieures, quand bien même elles émaneraient de prospects antérieurement présentés par l'Apporteur.


ARTICLE 11. ÉVOLUTION DU PROGRAMME

La Société peut faire évoluer, pour l'avenir, les conditions du programme d'apporteur d'affaires, y compris le montant de la commission et les règles d'attribution, en publiant une nouvelle version du contrat soumise à l'acceptation expresse de l'Apporteur par signature électronique. Les ventes déjà attribuées restent régies par la version applicable au jour de leur attribution, et le montant correspondant ne peut être révisé à la baisse. À défaut de signature de la nouvelle version, l'accès au programme pour de nouveaux apports peut être suspendu. Aucune modification ne résulte du seul silence ou de la simple poursuite d'activité de l'Apporteur.


ARTICLE 12. DISPOSITIONS DIVERSES

12.1. Cession. L'Apporteur ne peut céder le présent contrat sans l'accord écrit de la Société. La Société peut librement le céder ou le transférer, notamment dans le cadre d'une réorganisation ou d'une transmission de son activité.

12.2. Force majeure. Aucune Partie n'est responsable d'un manquement dû à un cas de force majeure au sens de l'article 1218 du Code civil.

12.3. Non-renonciation et divisibilité. Le fait pour une Partie de ne pas se prévaloir d'une stipulation ne vaut pas renonciation. La nullité d'une clause n'affecte pas la validité des autres.

12.4. Intégralité. Le présent contrat, ensemble les conditions du programme communiquées par la Société, exprime l'intégralité de l'accord des Parties sur son objet.

12.5. Élection de domicile. Les Parties élisent domicile aux adresses figurant à leur compte ou dans leurs coordonnées de signature ; tout changement doit être notifié à l'autre Partie.


ARTICLE 13. SIGNATURE ÉLECTRONIQUE

Les Parties conviennent de recourir à la signature électronique. Conformément à l'article 1367 du Code civil et à l'article 25 du règlement (UE) n° 910/2014 (eIDAS), une signature électronique ne peut être privée d'effet juridique au seul motif qu'elle se présente sous forme électronique. Les Parties reconnaissent la valeur probante du présent procédé de signature électronique simple, dont la fiabilité résulte de l'identification par compte authentifié, de l'horodatage et de la conservation d'une piste d'audit, et renoncent à en contester la validité au seul motif de sa forme. Un exemplaire signé est mis à la disposition de l'Apporteur dans son espace.


ARTICLE 14. DROIT APPLICABLE ET LITIGES

Le présent contrat est soumis au droit français. En cas de différend, les Parties rechercheront une solution amiable. Lorsque l'Apporteur agit en qualité de commerçant, tout litige relève de la compétence exclusive des tribunaux de Paris, ce que les Parties acceptent expressément (article 48 du Code de procédure civile). Dans tous les autres cas, la compétence est déterminée par les règles de droit commun.


En signant, l'Apporteur reconnaît avoir lu et compris l'ensemble des stipulations qui précèdent et les accepter sans réserve.`;
