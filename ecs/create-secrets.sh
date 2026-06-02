#!/bin/bash
set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "🔐 Creating AWS Secrets Manager secrets for JobJeeves..."

# Create Groq API key secret
read -sp "Enter Groq API Key: " GROQ_API_KEY
echo ""
aws secretsmanager create-secret \
  --name jobjeeves/groq-api-key \
  --description "Groq API key for JobJeeves backend" \
  --secret-string "${GROQ_API_KEY}" \
  --region ${AWS_REGION} \
  || echo "Secret may already exist. Use update-secret to change it."

# Create OpenAI API key secret (optional)
read -p "Do you want to create OpenAI API key secret? (y/n): " CREATE_OPENAI
if [[ $CREATE_OPENAI == "y" ]]; then
  read -sp "Enter OpenAI API Key: " OPENAI_API_KEY
  echo ""
  aws secretsmanager create-secret \
    --name jobjeeves/openai-api-key \
    --description "OpenAI API key for JobJeeves backend" \
    --secret-string "${OPENAI_API_KEY}" \
    --region ${AWS_REGION} \
    || echo "Secret may already exist. Use update-secret to change it."
fi

echo "✅ Secrets created!"
echo ""
echo "To update secrets later:"
echo "  aws secretsmanager update-secret --secret-id jobjeeves/groq-api-key --secret-string 'NEW_KEY' --region ${AWS_REGION}"
