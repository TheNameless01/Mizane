# Mizan (ميزan) — Customer Credit Ledger & Debt Collection for Algerian Wholesalers

Mizan est une application web rapide, conçue pour les grossistes et commerçants algériens. Elle permet d'enregistrer les ventes à crédit et au comptant, d'encaisser des règlements partiels, totaux ou par anticipation (avances / acomptes), de suivre en temps réel qui doit quoi avec une balance âgée (échéancier FIFO), et d'éditer ou partager des relevés de compte client imprimables au format A4 ou via WhatsApp.

---

## Prérequis

- **Node.js** : v20.x ou v22.x LTS recommandé (testé avec succès sous Node v22.23.3)
- **Système d'exploitation** : Linux, macOS, ou Windows (WSL2 / natif)
- **Moteur de base de données** : SQLite 3 (embarqué via `better-sqlite3`, aucun serveur externe de base de données requis)

---

## Démarrage rapide (Commandes exactes)

### 1. Installation des dépendances
```bash
npm install --legacy-peer-deps
```

### 2. Configuration des variables d'environnement
Copiez le fichier d'exemple si nécessaire :
```bash
cp .env.example .env
```
Variables disponibles :
- `PORT` : Port d'écoute du serveur web (défaut : `3000`).
- `DATABASE_PATH` : Emplacement du fichier SQLite (défaut : `./data/mizan.db`).

### 3. Exécution des tests unitaires et d'intégrité comptable
```bash
npm test
```
*Vitest exécute 19 tests stricts sur une base SQLite en mémoire (`:memory:`) pour valider les calculs monétaires, l'intégrité du grand livre, la formule d'échéancier et les fuseaux horaires.*

### 4. (Optionnel) Chargement de données de démonstration pour grossiste algérien
```bash
npm run db:seed
```
*Crée automatiquement des clients représentatifs (Bab Ezzouar, Blida, Hadjout, Rouiba) avec des ventes de semoule, huile Elio, farine, sucre et des encaissements par chèque/espèces.*

### 5. Démarrage en développement
```bash
npm run dev
```
Ouvrez votre navigateur sur : **`http://localhost:3000`**

### 6. Build pour production & Démarrage
```bash
npm run build
npm start
```

---

## Règles d'ingénierie & Intégrité du Grand Livre (Non négociables)

### 1. Monnaie & Précision absolue (Centimes d'Algérie)
- **Zéro flottant** : Tous les montants financiers sont stockés et calculés sous forme d'**entiers stricts en centimes** (1 DZD = 100 centimes).
- **Quantités en millièmes** : Les grossistes vendant souvent au poids ou au volume (ex: 2.500 kg, 1.250 L), les quantités sont stockées en millièmes d'entiers (ex: `2500` pour 2,5 kg).
- **Formule d'arrondi bancaire** :
  $$\text{Total Ligne} = \left\lfloor \frac{\text{Quantité (millièmes)} \times \text{Prix Unitaire (centimes)} + 500}{1000} \right\rfloor$$
- **Formatage localisé** : Formaté en `fr-DZ` avec chiffres latins (`numberingSystem: "latn"`), normalisation des espaces insécables et affichage clair du symbole `DZD`.

### 2. Calcul du Solde dérivé du registre (Pas de colonne éditable)
Le solde d'un client n'est jamais stocké ni éditable directement dans une colonne. Il est toujours calculé dynamiquement à partir des écritures :
$$\text{Solde} = \sum(\text{Ventes non annulées}) + \sum(\text{Ajustements Débit}) - \sum(\text{Paiements non annulés}) - \sum(\text{Ajustements Crédit})$$
- **Solde positif** : Le client doit de l'argent (« **Solde dû** »).
- **Solde négatif** : Le client dispose d'une avance ou d'un acompte (« **Crédit client** »). Le système n'écrase jamais un crédit à zéro.

### 3. Vente au comptant atomique
Une vente payée immédiatement (comptant) enregistre la vente **et** la quittance de paiement dans la même transaction atomique SQLite. Le solde du client reste donc strictement inchangé.

### 4. Reprise des anciens soldes (Carnet papier)
La migration des anciennes créances manuscrites s'effectue via une écriture d'**ajustement** (« Solde initial ») avec une date d'effet et une note d'audit obligatoire.

### 5. Pas de suppression dure (Annulation / Void)
Les écritures financières ne sont jamais effacées de la base de données. Une annulation enregistre la date et le motif d'annulation. L'écriture reste visible (barrée) sur le relevé de compte mais est exclue des totaux du solde.

### 6. Algorithme d'échéancier et balance âgée (FIFO / Oldest-First)
Les règlements et crédits d'un client sont automatiquement alloués aux ventes les plus anciennes. Le solde restant impayé est ventilé selon la date d'échéance des ventes :
- **Non échu (Courant)** : Date d'échéance non atteinte.
- **1 à 30 jours de retard**
- **31 à 60 jours de retard**
- **61 à 90 jours de retard**
- **+90 jours de retard**

### 7. Fuseau horaire Africa/Algiers
Toutes les dates calendaires, délimitations journalières (« aujourd'hui ») et coupures de relevés sont calculées en fuseau `Africa/Algiers` (UTC+1 fixe, sans heure d'été).

---

## Sauvegarde, Restauration et Réinitialisation

### Emplacement de la base de données
Par défaut, la base de données réside dans :
`./data/mizan.db` (avec les fichiers temporaires WAL `./data/mizan.db-wal` et `./data/mizan.db-shm`).
Ce répertoire est ignoré par Git (`.gitignore`).

### Sauvegarde en un clic
1. Dans l'application, rendez-vous dans **Paramètres**.
2. Cliquez sur **Télécharger le fichier .db**.
3. Vous pouvez également copier directement le fichier `./data/mizan.db` lorsque le serveur est arrêté ou avec l'API SQLite VACUUM INTO.

### Restauration
Pour restaurer une sauvegarde :
1. Arrêtez le serveur Node (`Ctrl+C`).
2. Remplacez `./data/mizan.db` par votre fichier de sauvegarde.
3. Supprimez les fichiers `-wal` et `-shm` s'ils existent : `rm -f data/mizan.db-wal data/mizan.db-shm`.
4. Relancez le serveur : `npm run dev`.

### Réinitialisation à zéro
Pour repartir d'une base vide :
```bash
rm -rf data/mizan.db*
npm run dev
```

---

## Relevé de compte client & Impression A4

Chaque fiche client dispose d'un bouton **Imprimer relevé** :
- En-tête officiel grossiste avec Raison sociale, Adresse, Téléphone et identifiants fiscaux algériens (NIF, NIS, RC, Article d'Imposition).
- Période filtrable (Du ... Au ...).
- Ligne de solde d'ouverture avant la période.
- Tableau chronologique des pièces avec libellé, débits, crédits et **solde courant après chaque opération**.
- Totaux de période et solde de clôture.
- Cadres pour cachet de l'entreprise et bon pour accord du client.
- Feuille de style optimisée `@media print` masquant toute la barre latérale et les boutons.

---

## Relance client multicanal (Gratuit / Sans API payante)

Le bouton **Relancer client** génère un message en français courtois adapté aux commerçants algériens indiquant :
- Le nom du client
- Le montant exact de la créance due
- La date du dernier règlement enregistré
- Un lien direct WhatsApp (`wa.me`) prérempli avec l'indicatif Algérie (`+213`)
- Un lien SMS direct (`sms:`)
- Un lien d'appel téléphonique (`tel:`)
- Un bouton de copie instantanée dans le presse-papier

---

## Utilisation en réseau local (LAN / Wi-Fi magasin)

L'application écoute par défaut sur toutes les interfaces réseau (`0.0.0.0:3000`).
Pour y accéder depuis une tablette, un smartphone ou un autre PC du magasin connecté au même réseau Wi-Fi :
1. Trouvez l'adresse IP locale de votre machine (ex: `192.168.1.50`).
2. Sur la tablette ou le smartphone, tapez : `http://192.168.1.50:3000`.

---

## Évolution vers l'Arabe (RTL Readiness)

Le projet a été développé en respectant la directive **RTL-first** :
- Utilisation exclusive des utilitaires logiques Tailwind CSS : `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`.
- Le catalogue de textes est centralisé dans `src/shared/i18n/fr.json`.
- Pour ajouter l'arabe ultérieurement :
  1. Créer `src/shared/i18n/ar.json`.
  2. Ajouter le sélecteur de langue et commuter l'attribut HTML `dir="rtl"` et `lang="ar"`.

---

## Avertissement & Limites connues

1. **Absence d'authentification en v1** : L'application est conçue pour un usage monoposte en local ou sur un réseau local privé sécurisé de magasin.
2. **Cadre fiscal** : Mizan v1 est un registre interne de gestion de compte client et d'aide au recouvrement. Ce n'est pas une caisse enregistreuse homologuée ou un logiciel de facturation fiscale certifié. Validez toutes vos obligations déclaratives avec votre comptable agréé ou commissaire aux comptes.
