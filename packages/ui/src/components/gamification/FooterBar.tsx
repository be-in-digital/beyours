"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface FooterBarProps {
  storeName: string
  primaryColor?: string
}

function FooterDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto"
          >
            <div className="mx-3 mb-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3">
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-5 pb-5 text-sm text-white/70 leading-relaxed">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function FooterBar({ storeName, primaryColor: _primaryColor }: FooterBarProps) {
  const [showReglement, setShowReglement] = useState(false)
  const [showContact, setShowContact] = useState(false)

  return (
    <>
      <div className="relative z-20 shrink-0 flex justify-center gap-8 py-3 mx-4 mb-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
        <button
          onClick={() => setShowReglement(true)}
          className="text-white/50 text-xs underline underline-offset-2 hover:text-white/70 transition-colors cursor-pointer"
        >
          Reglement
        </button>
        <button
          onClick={() => setShowContact(true)}
          className="text-white/50 text-xs underline underline-offset-2 hover:text-white/70 transition-colors cursor-pointer"
        >
          Contact
        </button>
      </div>

      {/* Reglement dialog */}
      <FooterDialog
        open={showReglement}
        onClose={() => setShowReglement(false)}
        title="Reglement du jeu"
      >
        <div className="space-y-3">
          <p className="font-medium text-white/90">Article 1 — Organisation</p>
          <p>
            Le jeu est organise par <strong className="text-white">{storeName}</strong>.
            La participation est gratuite et sans obligation d&apos;achat.
          </p>

          <p className="font-medium text-white/90">Article 2 — Conditions de participation</p>
          <p>
            Le jeu est ouvert a toute personne physique majeure. Chaque participant peut jouer
            une fois par periode de 24 heures (cooldown). La participation necessite de completer
            les actions sociales demandees.
          </p>

          <p className="font-medium text-white/90">Article 3 — Dotations</p>
          <p>
            Les lots sont determines aleatoirement par le systeme. Les prix ne sont ni
            echangeables, ni remboursables. En cas de rupture de stock, un prix de valeur
            equivalente pourra etre propose.
          </p>

          <p className="font-medium text-white/90">Article 4 — Attribution des lots</p>
          <p>
            Le gagnant recoit un code de validation par email. Ce code doit etre presente
            en restaurant pour recuperer le lot. Le code a une duree de validite limitee
            indiquee lors de la remise.
          </p>

          <p className="font-medium text-white/90">Article 5 — Donnees personnelles</p>
          <p>
            Les informations collectees sont utilisees uniquement pour la gestion du jeu
            et l&apos;envoi du lot. Conformement au RGPD, vous pouvez exercer vos droits
            en contactant l&apos;etablissement.
          </p>
        </div>
      </FooterDialog>

      {/* Contact dialog */}
      <FooterDialog
        open={showContact}
        onClose={() => setShowContact(false)}
        title="Contact"
      >
        <div className="space-y-4">
          <p>
            Pour toute question concernant le jeu, les prix ou vos donnees personnelles,
            contactez-nous directement :
          </p>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-lg">🏪</span>
              <span className="text-white font-medium">{storeName}</span>
            </div>
            <p className="text-xs text-white/50">
              Rendez-vous directement en restaurant ou contactez le personnel
              pour toute reclamation concernant un prix ou le jeu.
            </p>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-lg">📧</span>
              <span className="text-white/80">Email</span>
            </div>
            <p className="text-xs text-white/50">
              Demandez l&apos;adresse email au personnel de l&apos;etablissement.
            </p>
          </div>

          <p className="text-xs text-white/40 text-center pt-2">
            Jeu propulse par BeInDigital
          </p>
        </div>
      </FooterDialog>
    </>
  )
}
