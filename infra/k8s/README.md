# Kubernetes Deployment

These manifests target AKS or any Kubernetes cluster. They assume PostgreSQL, Blob Storage and Service Bus are managed services from Azure, while Qdrant runs inside the cluster for the portfolio demo.

## Required secret

Create the secret from real values before applying the manifests:

```powershell
kubectl create namespace agentops
kubectl create secret generic agentops-secrets `
  --namespace agentops `
  --from-literal POSTGRES_URL="postgres://agentopsadmin:<password>@<postgres-host>:5432/agentops?sslmode=require" `
  --from-literal AZURE_STORAGE_CONNECTION_STRING="<storage-connection-string>" `
  --from-literal AZURE_SERVICE_BUS_CONNECTION_STRING="<service-bus-connection-string>" `
  --from-literal LITELLM_API_KEY="<litellm-key>" `
  --from-literal API_KEYS="operator:<operator-key>,reviewer:<reviewer-key>,admin:<admin-key>"
```

Do not commit a real Secret manifest. `secret.example.yaml` is only a template.

## Deploy

```powershell
kubectl apply -k infra/k8s
```

## Images

Update image names through Kustomize:

```powershell
kubectl kustomize infra/k8s
```

Azure DevOps can also replace images during the `KubernetesManifest@0` deploy step.

## Notes

- The frontend image uses relative API calls by default. Nginx proxies `/api`, `/health`, `/readiness` and `/docs` to the backend service inside the cluster. API docs are disabled by default in production; set `ENABLE_API_DOCS=true` only for controlled internal environments.
- For production, replace the `LoadBalancer` service with an ingress controller and TLS.
- For durable Qdrant data, replace `emptyDir` with an Azure Disk-backed `PersistentVolumeClaim`.
