#!/bin/bash
# Verification script to check ECS configuration before deployment

set -e

echo "🔍 Verifying ECS deployment configuration..."

ERRORS=0

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI not found"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ AWS CLI found"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ Docker found"
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
  echo "❌ AWS credentials not configured"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ AWS credentials configured"
  AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  AWS_REGION=$(aws configure get region || echo "us-east-1")
  echo "   Account ID: $AWS_ACCOUNT_ID"
  echo "   Region: $AWS_REGION"
fi

# Check task definition file
if [ ! -f "ecs/task-definition.json" ]; then
  echo "❌ task-definition.json not found"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ task-definition.json found"
  
  # Check for placeholders
  if grep -q "YOUR_ACCOUNT_ID" ecs/task-definition.json; then
    echo "⚠️  WARNING: task-definition.json contains placeholder YOUR_ACCOUNT_ID"
  fi
  if grep -q "YOUR_SUPABASE_DATABASE_URL" ecs/task-definition.json; then
    echo "⚠️  WARNING: task-definition.json contains placeholder YOUR_SUPABASE_DATABASE_URL"
  fi
  if grep -q "REGION" ecs/task-definition.json; then
    echo "⚠️  WARNING: task-definition.json contains placeholder REGION"
  fi
fi

# Check IAM roles
if aws iam get-role --role-name ecsTaskExecutionRole &> /dev/null; then
  echo "✅ IAM role 'ecsTaskExecutionRole' exists"
else
  echo "⚠️  WARNING: IAM role 'ecsTaskExecutionRole' not found"
fi

if aws iam get-role --role-name ecsTaskRole &> /dev/null; then
  echo "✅ IAM role 'ecsTaskRole' exists"
else
  echo "⚠️  WARNING: IAM role 'ecsTaskRole' not found"
fi

# Check ECR repository
if [ -n "$AWS_ACCOUNT_ID" ] && [ -n "$AWS_REGION" ]; then
  if aws ecr describe-repositories --repository-names jobjeeves-backend --region $AWS_REGION &> /dev/null; then
    echo "✅ ECR repository 'jobjeeves-backend' exists"
  else
    echo "⚠️  WARNING: ECR repository 'jobjeeves-backend' not found (run setup-infrastructure.sh)"
  fi
fi

# Check secrets
if aws secretsmanager describe-secret --secret-id jobjeeves/groq-api-key --region ${AWS_REGION:-us-east-1} &> /dev/null; then
  echo "✅ Secret 'jobjeeves/groq-api-key' exists"
else
  echo "⚠️  WARNING: Secret 'jobjeeves/groq-api-key' not found (run create-secrets.sh)"
fi

# Check ECS cluster
if aws ecs describe-clusters --clusters jobjeeves-cluster --region ${AWS_REGION:-us-east-1} &> /dev/null; then
  echo "✅ ECS cluster 'jobjeeves-cluster' exists"
else
  echo "⚠️  WARNING: ECS cluster 'jobjeeves-cluster' not found (run setup-infrastructure.sh)"
fi

# Check CloudWatch log group
if aws logs describe-log-groups --log-group-name-prefix /ecs/jobjeeves-backend --region ${AWS_REGION:-us-east-1} --query 'logGroups[0].logGroupName' --output text 2>/dev/null | grep -q jobjeeves; then
  echo "✅ CloudWatch log group '/ecs/jobjeeves-backend' exists"
else
  echo "⚠️  WARNING: CloudWatch log group not found (run setup-infrastructure.sh)"
fi

# Check backend Dockerfile
if [ -f "backend/Dockerfile" ]; then
  echo "✅ Backend Dockerfile found"
  if grep -q "curl" backend/Dockerfile; then
    echo "✅ Dockerfile includes curl for health checks"
  else
    echo "⚠️  WARNING: Dockerfile may not include curl (health checks may fail)"
  fi
else
  echo "❌ Backend Dockerfile not found"
  ERRORS=$((ERRORS + 1))
fi

# Check backend requirements
if [ -f "backend/requirements.txt" ]; then
  echo "✅ Backend requirements.txt found"
  if grep -q "psycopg" backend/requirements.txt; then
    echo "✅ PostgreSQL driver (psycopg) found in requirements"
  else
    echo "❌ PostgreSQL driver (psycopg) not found in requirements"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "❌ Backend requirements.txt not found"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "✅ Configuration verification complete! Ready to deploy."
else
  echo "❌ Found $ERRORS error(s). Please fix before deploying."
  exit 1
fi
