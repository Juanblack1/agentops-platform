# CopilotKit - Proxima Integracao

O frontend usa um console proprio neste primeiro corte para manter o MVP executavel sem runtime AG-UI. As dependencias de CopilotKit devem entrar na proxima iteracao, junto com a rota AG-UI do Mastra server.

## Caminho recomendado

1. Subir um Mastra server separado ou promover `backend/src/mastra` para o runtime principal.
2. Registrar uma rota AG-UI usando `@ag-ui/mastra`.
3. Expor a rota, por exemplo `http://localhost:4111/chat`.
4. Instalar os pacotes:

```powershell
npm install @copilotkit/react-core @copilotkit/react-ui -w frontend
```

5. No frontend, trocar o console proprio por:

```tsx
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export function AgentCopilot() {
  return (
    <CopilotKit runtimeUrl="http://localhost:4111/chat" agent="supervisor">
      <CopilotChat
        labels={{
          title: "Supervisor Agent",
          initial: "Como posso ajudar na operacao?"
        }}
      />
    </CopilotKit>
  );
}
```

## Por que nao entrou no primeiro corte

O primeiro objetivo e ter uma plataforma local estavel com backend, RAG, auditoria e workflow. Alem disso, a versao atual de `@copilotkit/react-ui` trouxe um alerta moderado transitivo de `prismjs` no `npm audit`. A integracao AG-UI completa entra melhor depois que o Mastra server estiver rodando como processo proprio e o pacote estiver sem alerta relevante ou com mitigacao aceita.
