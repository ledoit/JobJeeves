# Deploying JobJeeves Backend to AWS ECS with Supabase Postgres

This guide walks you through deploying the JobJeeves FastAPI backend to AWS ECS (Fargate) and connecting it to a Supabase managed PostgreSQL database.

## Architecture Overview

- **Backend**: FastAPI application running on AWS ECS Fargate
- **Database**: Supabase managed PostgreSQL
- **Container Registry**: AWS ECR
- **Secrets**: AWS Secrets Manager for API keys
- **Load Balancer**: Application Load Balancer (optional but recommended)

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- Docker installed
- Supabase account
- Groq or OpenAI API key
- Basic knowledge of AWS services (ECS, ECR, VPC, IAM)

## Step 1: Set Up Supabase Database

### 1.1 Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization, project name, database password, and region
4. Wait for the project to be created (2-3 minutes)

### 1.2 Get Database Connection String

1. In your Supabase project, go to **Settings** → **Database**
2. Under "Connection string", select **URI** tab
3. Copy the connection string (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)
4. Replace `[YOUR-PASSWORD]` with your actual database password
5. **Important**: For SQLAlchemy/SQLModel, use `postgresql+psycopg://` instead of `postgresql://`:
   ```
   postgresql+psycopg://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

### 1.3 Configure Database Access

1. In Supabase Dashboard → **Settings** → **Database**
2. Under "Connection pooling", note the **Session mode** connection string (if using connection pooling)
3. For ECS, you can use either:
   - **Direct connection** (Session mode): Better for migrations and transactions
   - **Connection pooler** (Transaction mode): Better for serverless/high concurrency

### 1.4 Test Database Connection (Optional)

```bash
# Install psql or use Supabase SQL Editor
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

## Step 2: Set Up AWS Infrastructure

### 2.1 Configure AWS CLI

```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, region, and output format
```

### 2.2 Create IAM Roles

#### Task Execution Role (for ECS to pull images and access secrets)

```bash
# Create the role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach the policy
aws iam put-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name ecsTaskExecutionRolePolicy \
  --policy-document file://ecs/iam-task-execution-role-policy.json
```

#### Task Role (for the application itself)

```bash
# Create the role
aws iam create-role \
  --role-name ecsTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach the policy
aws iam put-role-policy \
  --role-name ecsTaskRole \
  --policy-name ecsTaskRolePolicy \
  --policy-document file://ecs/iam-task-role-policy.json
```

**Note**: Get the ARNs of these roles for the task definition:
```bash
aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.Arn' --output text
aws iam get-role --role-name ecsTaskRole --query 'Role.Arn' --output text
```

### 2.3 Set Up AWS Resources

```bash
# Make scripts executable
chmod +x ecs/setup-infrastructure.sh
chmod +x ecs/create-secrets.sh
chmod +x ecs/deploy.sh

# Run infrastructure setup
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export VPC_ID=vpc-xxxxxxxxx  # Your default VPC or custom VPC
export SUBNET_IDS=subnet-xxx,subnet-yyy  # At least 2 subnets in different AZs

./ecs/setup-infrastructure.sh
```

### 2.4 Create Secrets in AWS Secrets Manager

```bash
./ecs/create-secrets.sh
```

Or manually:

```bash
# Groq API Key
aws secretsmanager create-secret \
  --name jobjeeves/groq-api-key \
  --secret-string "YOUR_GROQ_API_KEY" \
  --region us-east-1

# OpenAI API Key (optional)
aws secretsmanager create-secret \
  --name jobjeeves/openai-api-key \
  --secret-string "YOUR_OPENAI_API_KEY" \
  --region us-east-1
```

**Get the secret ARNs** (needed for task definition):
```bash
aws secretsmanager describe-secret --secret-id jobjeeves/groq-api-key --query 'ARN' --output text
aws secretsmanager describe-secret --secret-id jobjeeves/openai-api-key --query 'ARN' --output text
```

## Step 3: Configure Task Definition

### 3.1 Update Task Definition

Edit `ecs/task-definition.json` and replace:

- `YOUR_ACCOUNT_ID`: Your AWS account ID
- `REGION`: Your AWS region (e.g., `us-east-1`)
- `YOUR_SUPABASE_DATABASE_URL`: Your Supabase connection string (with `postgresql+psycopg://`)
- `YOUR_ACCOUNT_ID` in executionRoleArn and taskRoleArn
- Secret ARNs from Step 2.4
- `CORS_ORIGINS`: Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)

### 3.2 Register Task Definition

```bash
aws ecs register-task-definition \
  --cli-input-json file://ecs/task-definition.json \
  --region us-east-1
```

## Step 4: Set Up Networking (VPC and Security Groups)

### 4.1 Get VPC and Subnet Information

```bash
# List VPCs
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,CidrBlock]' --output table

# List subnets
aws ec2 describe-subnets --query 'Subnets[*].[SubnetId,AvailabilityZone,CidrBlock]' --output table
```

### 4.2 Create/Update Security Group

The `setup-infrastructure.sh` script creates a security group. Update it to allow:

- **Inbound**: Port 8000 from your ALB security group (if using ALB)
- **Outbound**: Port 443 (HTTPS) to Supabase and AWS services

```bash
# Get security group ID
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=jobjeeves-backend-sg" \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

echo "Security Group ID: $SECURITY_GROUP_ID"
```

## Step 5: Create Application Load Balancer (Recommended)

### 5.1 Create ALB

```bash
# Create target group
aws elbv2 create-target-group \
  --name jobjeeves-backend-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id vpc-xxxxxxxxx \
  --target-type ip \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3

# Create load balancer
aws elbv2 create-load-balancer \
  --name jobjeeves-backend-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-alb-xxx \
  --scheme internet-facing \
  --type application

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:REGION:ACCOUNT:loadbalancer/app/NAME/ID \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:REGION:ACCOUNT:targetgroup/NAME/ID
```

### 5.2 Update Service Definition

Update `ecs/service-definition.json` with:
- Your subnet IDs
- Your security group ID
- Your target group ARN

## Step 6: Create ECS Service

### 6.1 Update Service Definition

Edit `ecs/service-definition.json` and replace:
- Subnet IDs
- Security group ID
- Target group ARN (if using ALB)

### 6.2 Create Service

```bash
aws ecs create-service \
  --cli-input-json file://ecs/service-definition.json \
  --region us-east-1
```

**Without Load Balancer** (for testing):

```bash
aws ecs create-service \
  --cluster jobjeeves-cluster \
  --service-name jobjeeves-backend-service \
  --task-definition jobjeeves-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --region us-east-1
```

## Step 7: Deploy Backend

### 7.1 Build and Push Docker Image

```bash
# Update deploy.sh with your AWS account ID and region
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

./ecs/deploy.sh
```

Or manually:

```bash
cd backend
docker build -t jobjeeves-backend:latest .

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag jobjeeves-backend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/jobjeeves-backend:latest

docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/jobjeeves-backend:latest
```

### 7.2 Force New Deployment

```bash
aws ecs update-service \
  --cluster jobjeeves-cluster \
  --service jobjeeves-backend-service \
  --force-new-deployment \
  --region us-east-1
```

## Step 8: Verify Deployment

### 8.1 Check Service Status

```bash
aws ecs describe-services \
  --cluster jobjeeves-cluster \
  --services jobjeeves-backend-service \
  --region us-east-1
```

### 8.2 Get Task IP or ALB URL

**With ALB:**
```bash
aws elbv2 describe-load-balancers \
  --names jobjeeves-backend-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text
```

**Without ALB:**
```bash
# Get task IP
TASK_ARN=$(aws ecs list-tasks \
  --cluster jobjeeves-cluster \
  --service-name jobjeeves-backend-service \
  --query 'taskArns[0]' \
  --output text)

aws ecs describe-tasks \
  --cluster jobjeeves-cluster \
  --tasks $TASK_ARN \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text
```

### 8.3 Test Health Endpoint

```bash
# With ALB
curl http://YOUR-ALB-DNS-NAME/api/health

# Without ALB (using task IP)
curl http://TASK_IP:8000/api/health
```

### 8.4 Test Analyze Endpoint

```bash
curl -X POST http://YOUR-ALB-DNS-NAME/api/analyze \
  -F "file=@resume.pdf" \
  -F "job_description=Software Engineer position..."
```

### 8.5 Check Logs

```bash
aws logs tail /ecs/jobjeeves-backend --follow --region us-east-1
```

## Step 9: Connect Vercel Frontend

### 9.1 Get Backend URL

- **With ALB**: Use the ALB DNS name (or configure a custom domain)
- **Without ALB**: Use the public IP of the ECS task (less reliable, IPs change)

### 9.2 Set Vercel Environment Variable

In Vercel Dashboard → Your Project → Settings → Environment Variables:

- **Name**: `VITE_API_URL`
- **Value**: `http://YOUR-ALB-DNS-NAME` (or `https://` if using HTTPS/SSL)

**Important**: 
- No trailing slash
- Use `http://` or `https://` prefix
- For production, set up HTTPS with AWS Certificate Manager and ALB

### 9.3 Redeploy Frontend

After setting the environment variable, redeploy your Vercel app. The frontend will now make API requests to your ECS backend.

## Step 10: Set Up HTTPS (Production)

### 10.1 Request SSL Certificate

```bash
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

### 10.2 Update ALB Listener

```bash
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

## Environment Variables Reference

### Required in Task Definition

- `DATABASE_URL`: Supabase PostgreSQL connection string (with `postgresql+psycopg://`)
- `GROQ_API_KEY` or `OPENAI_API_KEY`: From Secrets Manager
- `CORS_ORIGINS`: Comma-separated list of allowed origins (your Vercel URL)

### Optional

- `LLM_PROVIDER`: `groq` (default) or `openai`
- `GROQ_MODEL`: Model name (default: `llama-3.1-8b-instant`)
- `OPENAI_MODEL`: Model name (default: `gpt-4o-mini`)

## Troubleshooting

### Database Connection Issues

1. **Check Supabase connection string format**: Must use `postgresql+psycopg://` for SQLAlchemy
2. **Verify security group**: ECS task must allow outbound HTTPS (port 443) to Supabase
3. **Check Supabase IP allowlist**: Ensure your ECS task's IP is allowed (or allow all if using Supabase's public endpoint)

### Container Won't Start

1. **Check CloudWatch logs**: `aws logs tail /ecs/jobjeeves-backend --follow`
2. **Verify task definition**: Check CPU/memory limits
3. **Check IAM roles**: Task execution role needs ECR and Secrets Manager permissions

### API Returns 502/503

1. **Check health endpoint**: `/api/health` should return `{"ok": true}`
2. **Verify target group health**: Check ALB target group health checks
3. **Check security groups**: ALB → ECS task communication

### CORS Errors

1. **Update CORS_ORIGINS**: Include your exact Vercel URL (with `https://`)
2. **Redeploy service**: After updating environment variables

## Cost Optimization

- **Use Fargate Spot** for non-production: 70% cost savings
- **Right-size resources**: Start with 512 CPU / 1024 MB memory, adjust based on usage
- **Use connection pooling**: Supabase connection pooler for better performance
- **Enable ALB access logs**: Only if needed for debugging

## Security Best Practices

1. **Use Secrets Manager**: Never hardcode API keys
2. **Enable VPC endpoints**: For ECR and Secrets Manager (reduces internet traffic)
3. **Use private subnets**: With NAT Gateway for outbound internet (more secure)
4. **Enable WAF**: On ALB for DDoS protection
5. **Rotate secrets**: Regularly update API keys in Secrets Manager
6. **Use HTTPS**: Always use SSL/TLS in production

## Monitoring

- **CloudWatch Logs**: Application logs
- **CloudWatch Metrics**: CPU, memory, request count
- **ECS Service Events**: Deployment and health check events
- **ALB Access Logs**: HTTP request logs (if enabled)

## Cleanup

To remove all resources:

```bash
# Delete ECS service
aws ecs update-service \
  --cluster jobjeeves-cluster \
  --service jobjeeves-backend-service \
  --desired-count 0

aws ecs delete-service \
  --cluster jobjeeves-cluster \
  --service jobjeeves-backend-service

# Delete task definition
aws ecs deregister-task-definition \
  --task-definition jobjeeves-backend:1

# Delete ALB, target group, etc.
# Delete ECR repository
# Delete CloudWatch log group
# Delete Secrets Manager secrets
# Delete IAM roles and policies
```

## Next Steps

- Set up CI/CD pipeline (GitHub Actions, AWS CodePipeline)
- Configure custom domain with Route 53
- Set up monitoring and alerting
- Implement auto-scaling based on CPU/memory
- Set up backup strategy for Supabase database
