# ECS Deployment Files

This directory contains all the configuration files and scripts needed to deploy the JobJeeves backend to AWS ECS with Supabase Postgres.

## Files Overview

### Configuration Files

- **`task-definition.json`**: ECS task definition for the Fargate container
- **`service-definition.json`**: ECS service configuration (optional, for ALB setup)

### Scripts

- **`setup-infrastructure.sh`**: Creates ECR repository, ECS cluster, CloudWatch log group, and security group
- **`create-secrets.sh`**: Interactive script to create AWS Secrets Manager secrets for API keys
- **`deploy.sh`**: Builds Docker image, pushes to ECR, and updates ECS service
- **`verify-config.sh`**: Verifies all configuration before deployment
- **`test-backend-local.sh`**: Test backend locally with Supabase before deploying

### IAM Policies

- **`iam-task-execution-role-policy.json`**: IAM policy for ECS task execution role (ECR, CloudWatch, Secrets Manager access)
- **`iam-task-role-policy.json`**: IAM policy for ECS task role (application-level permissions)

### Documentation

- **`QUICK-START.md`**: Condensed deployment guide for experienced users
- **`../README-ecs-supabase.md`**: Comprehensive deployment guide with detailed instructions

## Quick Reference

### Typical Deployment Flow

1. **Set up Supabase**: Create project and get connection string
2. **Run infrastructure setup**: `./ecs/setup-infrastructure.sh`
3. **Create secrets**: `./ecs/create-secrets.sh`
4. **Create IAM roles**: See README-ecs-supabase.md
5. **Update configuration**: Edit `task-definition.json` with your values
6. **Register task definition**: `aws ecs register-task-definition --cli-input-json file://ecs/task-definition.json`
7. **Create ECS service**: See README-ecs-supabase.md
8. **Deploy**: `./ecs/deploy.sh`

### Environment Variables in Task Definition

The task definition uses these environment variables:

- `DATABASE_URL`: Supabase PostgreSQL connection string (format: `postgresql+psycopg://...`)
- `LLM_PROVIDER`: `groq` or `openai` (default: `groq`)
- `GROQ_MODEL`: Groq model name (default: `llama-3.1-8b-instant`)
- `OPENAI_MODEL`: OpenAI model name (default: `gpt-4o-mini`)
- `CORS_ORIGINS`: Comma-separated list of allowed origins (your Vercel URL)

Secrets (from AWS Secrets Manager):
- `GROQ_API_KEY`: Groq API key
- `OPENAI_API_KEY`: OpenAI API key (optional)

### Supabase Connection String Format

**Important**: Use `postgresql+psycopg://` prefix (not just `postgresql://`) for SQLAlchemy compatibility.

Example:
```
postgresql+psycopg://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Get this from: Supabase Dashboard → Settings → Database → Connection string (URI)

## Troubleshooting

### Common Issues

1. **Database connection fails**
   - Verify connection string uses `postgresql+psycopg://`
   - Check security group allows outbound HTTPS (443)
   - Verify Supabase project is active

2. **Container won't start**
   - Check CloudWatch logs: `aws logs tail /ecs/jobjeeves-backend --follow`
   - Verify IAM roles have correct permissions
   - Check task definition CPU/memory limits

3. **Health check fails**
   - Ensure Dockerfile includes `curl` (already updated)
   - Check `/api/health` endpoint is accessible
   - Verify container port 8000 is exposed

4. **CORS errors**
   - Update `CORS_ORIGINS` in task definition with exact Vercel URL
   - Include `https://` prefix
   - Redeploy service after updating

## Next Steps After Deployment

1. Set up Application Load Balancer for stable URL
2. Configure custom domain with Route 53
3. Set up HTTPS with AWS Certificate Manager
4. Enable auto-scaling based on CPU/memory
5. Set up monitoring and alerting
6. Configure CI/CD pipeline

## Cost Considerations

- **Fargate**: ~$0.04/vCPU-hour + ~$0.004/GB-hour
- **ECR**: Storage costs (minimal)
- **CloudWatch Logs**: First 5GB free, then $0.50/GB
- **ALB**: ~$0.0225/hour + data transfer
- **Supabase**: Free tier available, then usage-based

For development/testing, consider using Fargate Spot for 70% cost savings.
