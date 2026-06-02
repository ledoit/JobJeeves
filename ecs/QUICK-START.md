# Quick Start Guide: ECS + Supabase Deployment

This is a condensed guide for experienced AWS users. For detailed instructions, see [README-ecs-supabase.md](../README-ecs-supabase.md).

## Prerequisites Checklist

- [ ] AWS CLI configured (`aws configure`)
- [ ] Docker installed
- [ ] Supabase project created
- [ ] Groq or OpenAI API key

## 1. Supabase Setup (5 minutes)

1. Create project at [supabase.com](https://app.supabase.com)
2. Get connection string: Settings → Database → Connection string (URI)
3. Convert to SQLAlchemy format: `postgresql+psycopg://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

## 2. AWS Setup (15 minutes)

```bash
# Set variables
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text)
export SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[0:2].[SubnetId]' --output text | tr '\n' ',' | sed 's/,$//')

# Create infrastructure
./ecs/setup-infrastructure.sh

# Create secrets
./ecs/create-secrets.sh
```

## 3. IAM Roles

```bash
# Execution role
aws iam create-role --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam put-role-policy --role-name ecsTaskExecutionRole \
  --policy-name ecsTaskExecutionRolePolicy \
  --policy-document file://ecs/iam-task-execution-role-policy.json

# Task role
aws iam create-role --role-name ecsTaskRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam put-role-policy --role-name ecsTaskRole \
  --policy-name ecsTaskRolePolicy \
  --policy-document file://ecs/iam-task-role-policy.json
```

## 4. Update Configuration Files

### task-definition.json
- Replace `YOUR_ACCOUNT_ID` with your AWS account ID
- Replace `REGION` with your region
- Replace `YOUR_SUPABASE_DATABASE_URL` with Supabase connection string
- Update role ARNs with your account ID
- Update secret ARNs (get from: `aws secretsmanager describe-secret --secret-id jobjeeves/groq-api-key --query 'ARN' --output text`)
- Update `CORS_ORIGINS` with your Vercel URL

### service-definition.json
- Replace subnet IDs
- Replace security group ID (from setup-infrastructure.sh output)
- Update target group ARN (if using ALB)

## 5. Deploy

```bash
# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://ecs/task-definition.json \
  --region $AWS_REGION

# Create service (without ALB for testing)
aws ecs create-service \
  --cluster jobjeeves-cluster \
  --service-name jobjeeves-backend-service \
  --task-definition jobjeeves-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
  --region $AWS_REGION

# Build and push image
./ecs/deploy.sh
```

## 6. Get Backend URL

```bash
# Get task IP
TASK_ARN=$(aws ecs list-tasks --cluster jobjeeves-cluster --service-name jobjeeves-backend-service --query 'taskArns[0]' --output text)
ENI_ID=$(aws ecs describe-tasks --cluster jobjeeves-cluster --tasks $TASK_ARN --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text)
TASK_IP=$(aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --query 'NetworkInterfaces[0].Association.PublicIp' --output text)

echo "Backend URL: http://$TASK_IP:8000"
```

## 7. Test

```bash
# Health check
curl http://$TASK_IP:8000/api/health

# Should return: {"ok":true}
```

## 8. Connect Vercel

In Vercel Dashboard → Settings → Environment Variables:
- Name: `VITE_API_URL`
- Value: `http://$TASK_IP:8000` (or ALB DNS name if using ALB)

## Troubleshooting

- **Can't connect to database**: Check security group allows outbound HTTPS (443)
- **Container won't start**: Check CloudWatch logs: `aws logs tail /ecs/jobjeeves-backend --follow`
- **CORS errors**: Update `CORS_ORIGINS` in task definition and redeploy

## Next Steps

- Set up Application Load Balancer for stable URL
- Configure custom domain
- Set up HTTPS with ACM
- Enable auto-scaling
