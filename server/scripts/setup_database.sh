#!/bin/bash

# Load environment variables from .env file
if [ -f "../.env" ]; then
  export $(grep -v '^#' ../.env | xargs)
fi

# Set default values if environment variables are not set
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_NAME=${DB_NAME:-wolvesville}
DB_PORT=${DB_PORT:-5432}

# Check if PostgreSQL is installed
if ! command -v psql > /dev/null 2>&1; then
  echo "PostgreSQL is not installed. Please install PostgreSQL first."
  exit 1
fi

# Check if database exists
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
  echo "Database '$DB_NAME' already exists."
else
  echo "Creating database '$DB_NAME'..."
  createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
  if [ $? -eq 0 ]; then
    echo "Database created successfully."
  else
    echo "Failed to create database."
    exit 1
  fi
fi

echo "Database setup completed."

# Run database initialization script
echo "Initializing database schema..."
cd ..
node initializeDatabase.js

echo "Setup complete!" 