#!/bin/bash
set -e

# Configuration - Update these values
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-YOUR_ACCOUNT_ID}"
ECR_REPOSITORY="jobjeeves-backend"
ECS_CLUSTER="jobjeeves-cluster"
ECS_SERVICE="jobjeeves-backend-service"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "🚀 Starting deployment..."

# Step 1: Build Docker image
echo "📦 Building Docker image..."
cd "$(dirname "$0")/../backend"
docker build -t ${ECR_REPOSITORY}:${IMAGE_TAG} .

# Step 2: Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Step 3: Tag image
echo "🏷️  Tagging image..."
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}

# Step 4: Push to ECR
echo "⬆️  Pushing image to ECR..."
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}

# Step 5: Update ECS service
echo "🔄 Updating ECS service..."
aws ecs update-service \
  --cluster ${ECS_CLUSTER} \
  --service ${ECS_SERVICE} \
  --force-new-deployment \
  --region ${AWS_REGION}

echo "✅ Deployment initiated! Check ECS console for status."
echo "📊 Monitor logs: aws logs tail /ecs/jobjeeves-backend --follow --region ${AWS_REGION}"
