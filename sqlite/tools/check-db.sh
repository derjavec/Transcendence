#!/bin/sh
# Fichier: tools/check-db.sh

# Vérifier si le fichier existe
if [ ! -f /app/shared/database.db ]; then
  echo '📦 Creating database.db from init-db.sql...'
  sqlite3 /app/shared/database.db < /app/init-db.sql
  exit 0
fi

# Vérifier la structure de la base de données
echo '🔍 Checking database structure...'
TABLES=$(sqlite3 /app/shared/database.db "SELECT name FROM sqlite_master WHERE type='table'")

# Liste des tables requises
REQUIRED_TABLES="users user_stats blacklisted_tokens temp_2fa_setup friend_requests matches"

# Vérifier chaque table requise
MISSING=0
for table in $REQUIRED_TABLES; do
  if ! echo "$TABLES" | grep -q "$table"; then
    echo "❌ Table $table is missing"
    MISSING=1
  fi
done

# Recréer la structure si nécessaire
if [ $MISSING -eq 1 ]; then
  echo '🔄 Rebuilding database structure...'

  cp /app/shared/database.db /app/shared/database.db.bak
  sqlite3 /app/shared/database.db < /app/init-db.sql
else
  echo '✅ database.db has all required tables'
fi

echo '🔄 Resetting all player_connection statuses to offline...'
sqlite3 /app/shared/database.db "UPDATE player_connection SET status = 0;"
