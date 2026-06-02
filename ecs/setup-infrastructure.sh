#!/bin/bash
set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-YOUR_ACCOUNT_ID}"
ECR_REPOSITORY="jobjeeves-backend"
ECS_CLUSTER="jobjeeves-cluster"
VPC_ID="${VPC_ID:-vpc-xxxxxxxxxxxxxxxxx}"
SUBNET_IDS="${SUBNET_IDS:-subnet-xxxxxxxxxxxxxxxxx,subnet-yyyyyyyyyyyyyyyyy}"

echo "🏗️  Setting up AWS infrastructure for JobJeeves backend..."

# Step 1: Create ECR repository
echo "📦 Creating ECR repository..."
aws ecr create-repository \
  --repository-name ${ECR_REPOSITORY} \
  --region ${AWS_REGION} \
  --image-scanning-configuration scanOnPush=true \
  || echo "Repository may already exist"

# Step 2: Create ECS cluster
echo "🔧 Creating ECS cluster..."
aws ecs create-cluster \
  --cluster-name ${ECS_CLUSTER} \
  --region ${AWS_REGION} \
  || echo "Cluster may already exist"

# Step 3: Create CloudWatch log group
echo "📊 Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name /ecs/jobjeeves-backend \
  --region ${AWS_REGION} \
  || echo "Log group may already exist"

# Step 4: Create security group (if needed)
echo "🔒 Creating security group..."
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
  --group-name jobjeeves-backend-sg \
  --description "Security group for JobJeeves backend ECS tasks" \
  --vpc-id ${VPC_ID} \
  --region ${AWS_REGION} \
  --query 'GroupId' \
  --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=jobjeeves-backend-sg" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region ${AWS_REGION})

echo "Security Group ID: ${SECURITY_GROUP_ID}"

# Allow inbound traffic on port 8000 from ALB (update ALB security group ID)
# aws ec2 authorize-security-group-ingress \
#   --group-id ${SECURITY_GROUP_ID} \
#   --protocol tcp \
#   --port 8000 \
#   --source-group ${ALB_SECURITY_GROUP_ID} \
#   --region ${AWS_REGION}

# Allow outbound traffic to Supabase (HTTPS)
aws ec2 authorize-security-group-egress \
  --group-id ${SECURITY_GROUP_ID} \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region ${AWS_REGION} 2>/dev/null || echo "Egress rule may already exist"

# Allow outbound traffic for ECR and CloudWatch
aws ec2 authorize-security-group-egress \
  --group-id ${SECURITY_GROUP_ID} \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region ${AWS_REGION} 2>/dev/null || echo "Egress rule may already exist"

echo "✅ Infrastructure setup complete!"
echo ""
echo "Next steps:"
echo "1. Update task-definition.json with your AWS account ID and region"
echo "2. Create IAM roles (ecsTaskExecutionRole and ecsTaskRole)"
echo "3. Create Secrets Manager secrets for API keys"
echo "4. Create Application Load Balancer (optional but recommended)"
echo "5. Register task definition: aws ecs register-task-definition --cli-input-json file://ecs/task-definition.json"
echo "6. Create ECS service: aws ecs create-service --cli-input-json file://ecs/service-definition.json"
