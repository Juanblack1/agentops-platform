param location string = resourceGroup().location
param namePrefix string
param containerRegistryName string
param backendImage string
@secure()
param apiKeys string = ''
param llmProvider string = 'mock'
@secure()
param googleGenerativeAiApiKey string = ''
param googleGenerativeAiModel string = 'gemini-2.5-flash'
param corsOrigins string = ''
param enableApiDocs string = 'false'
@secure()
param postgresUrl string = ''
@secure()
param azureStorageConnectionString string = ''
@secure()
param azureServiceBusConnectionString string = ''
param azureStorageContainer string = 'agentops-documents'
param azureServiceBusTopic string = 'agentops-events'

var uniqueSuffix = uniqueString(resourceGroup().id, namePrefix, 'containerapps')
var workspaceName = '${namePrefix}-logs-${uniqueSuffix}'
var environmentName = '${namePrefix}-cae-${uniqueSuffix}'
var backendAppName = '${namePrefix}-backend-${uniqueSuffix}'
var identityName = '${namePrefix}-aca-id-${uniqueSuffix}'
var dataStore = empty(postgresUrl) ? 'memory' : 'postgres'
var vectorStore = empty(postgresUrl) ? 'memory' : 'pgvector'
var documentStorage = empty(azureStorageConnectionString) ? 'local' : 'azure-blob'
var outboxPublisher = empty(azureServiceBusConnectionString) ? 'local' : 'servicebus'

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: containerRegistryName
}

resource containerIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, containerIdentity.id, 'acrpull')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: containerIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: workspaceName
  location: location
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource containerEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logWorkspace.properties.customerId
        sharedKey: logWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: backendAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${containerIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3333
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: containerIdentity.id
        }
      ]
      secrets: [
        {
          name: 'api-keys'
          value: apiKeys
        }
        {
          name: 'google-generative-ai-api-key'
          value: googleGenerativeAiApiKey
        }
        {
          name: 'postgres-url'
          value: postgresUrl
        }
        {
          name: 'azure-storage-connection-string'
          value: azureStorageConnectionString
        }
        {
          name: 'azure-service-bus-connection-string'
          value: azureServiceBusConnectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3333'
            }
            {
              name: 'LOG_LEVEL'
              value: 'warn'
            }
            {
              name: 'ENABLE_API_DOCS'
              value: enableApiDocs
            }
            {
              name: 'CORS_ORIGINS'
              value: corsOrigins
            }
            {
              name: 'API_KEYS'
              secretRef: 'api-keys'
            }
            {
              name: 'LLM_PROVIDER'
              value: llmProvider
            }
            {
              name: 'GOOGLE_GENERATIVE_AI_API_KEY'
              secretRef: 'google-generative-ai-api-key'
            }
            {
              name: 'GOOGLE_GENERATIVE_AI_MODEL'
              value: googleGenerativeAiModel
            }
            {
              name: 'MASTRA_MODEL'
              value: 'google/${googleGenerativeAiModel}'
            }
            {
              name: 'DATA_STORE'
              value: dataStore
            }
            {
              name: 'POSTGRES_URL'
              secretRef: 'postgres-url'
            }
            {
              name: 'VECTOR_STORE'
              value: vectorStore
            }
            {
              name: 'DOCUMENT_STORAGE'
              value: documentStorage
            }
            {
              name: 'DOCUMENT_STORAGE_DIR'
              value: '/tmp/agentops-uploads'
            }
            {
              name: 'AZURE_STORAGE_CONNECTION_STRING'
              secretRef: 'azure-storage-connection-string'
            }
            {
              name: 'AZURE_STORAGE_CONTAINER'
              value: azureStorageContainer
            }
            {
              name: 'OUTBOX_PUBLISHER'
              value: outboxPublisher
            }
            {
              name: 'AZURE_SERVICE_BUS_CONNECTION_STRING'
              secretRef: 'azure-service-bus-connection-string'
            }
            {
              name: 'AZURE_SERVICE_BUS_TOPIC'
              value: azureServiceBusTopic
            }
            {
              name: 'SEED_DEMO_DATA'
              value: 'true'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    acrPullRole
  ]
}

output backendAppName string = backendApp.name
output backendUrl string = 'https://${backendApp.properties.configuration.ingress.fqdn}'
output logWorkspaceName string = logWorkspace.name
