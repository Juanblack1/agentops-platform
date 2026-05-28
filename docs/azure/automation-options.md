# Como automatizar o que seria manual

Voce tem quatro caminhos praticos para me permitir automatizar tarefas externas.

## 1. Azure CLI autenticado

Voce roda uma vez:

```powershell
az login
```

Depois eu consigo executar scripts como:

```powershell
.\infra\azure\provision.ps1 -ResourceGroupName rg-agentops-br-dev -Location brazilsouth -NamePrefix agentopsbrdev
.\infra\azure\export-backend-env.ps1 -ResourceGroupName rg-agentops-br-dev
.\infra\azure\build-and-push.ps1 -RegistryName <acr-name> -ImageTag dev-001
```

Este e o caminho mais simples na sua maquina.

## 2. Service principal via variaveis de ambiente

Voce cria um app registration/service principal e configura:

```powershell
$env:AZURE_CLIENT_ID="..."
$env:AZURE_TENANT_ID="..."
$env:AZURE_CLIENT_SECRET="..."
$env:AZURE_SUBSCRIPTION_ID="..."
```

Depois scripts Azure CLI, SDK ou Terraform podem autenticar sem browser.

## 3. MCP de Azure

Se voce tiver ou instalar um MCP com ferramentas Azure, eu posso usar essas ferramentas diretamente quando elas aparecerem na sessao. O MCP ideal precisa permitir:

- criar resource group
- deploy Bicep/Terraform
- ler outputs de deployment
- criar/ler segredos no Key Vault
- configurar Container Apps ou AKS

Sem esse MCP na lista de ferramentas da sessao, eu nao consigo chamar Azure diretamente por MCP.

## 4. SDKs no proprio projeto

O projeto ja usa SDKs configuraveis:

- `@azure/service-bus` para outbox.
- `@azure/storage-blob` para documentos brutos.
- `pg` para PostgreSQL.

Esses SDKs rodam quando voce preenche o `.env` com connection strings ou credenciais adequadas.

## 5. Azure DevOps e Kubernetes

Tambem deixei a automacao declarativa no repositorio:

- `azure-pipelines.yml` valida, builda imagens, publica no ACR e faz deploy no AKS.
- `infra/k8s` contem os manifests para backend, frontend, Qdrant, services e config.
- `infra/azure/main.bicep` cria recursos cloud base, incluindo ACR.

O que ainda precisa ser feito fora do codigo e autenticar/conectar a conta:

- criar os service connections no Azure DevOps
- criar o secret `agentops-secrets` no AKS ou usar Key Vault/CSI driver
- executar `az login` ou configurar service principal

## O que nao devo receber no chat

Nao cole senhas, connection strings ou API keys diretamente na conversa. Prefira:

- configurar variaveis de ambiente localmente
- usar `.env` local ignorado pelo Git
- usar Azure Key Vault
- usar `az login`
