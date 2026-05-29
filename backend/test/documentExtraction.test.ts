import { describe, expect, it } from "vitest";
import { extractDocumentText } from "../src/documents/extractDocumentText";

describe("document text extraction", () => {
  it("extracts text from DOCX files", async () => {
    const result = await extractDocumentText({
      filename: "politica.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from(DOCX_FIXTURE_BASE64, "base64")
    });

    expect(result.format).toBe("docx");
    expect(result.content).toContain("Politica DOCX para RAG");
  });

  it("extracts rows from XLSX files", async () => {
    const result = await extractDocumentText({
      filename: "runbook.xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(XLSX_FIXTURE_BASE64, "base64")
    });

    expect(result.format).toBe("xlsx");
    expect(result.content).toContain("Planilha: Runbook");
    expect(result.content).toContain("Politica XLSX para RAG");
  });

  it("converts HTML to readable text without script content", async () => {
    const result = await extractDocumentText({
      filename: "procedimento.html",
      mimetype: "text/html",
      buffer: Buffer.from(
        "<main><h1>Procedimento HTML para RAG</h1><p>Texto suficiente para a base de conhecimento.</p><script>alert('x')</script></main>"
      )
    });

    expect(result.format).toBe("html");
    expect(result.content).toContain("PROCEDIMENTO HTML PARA RAG");
    expect(result.content).not.toContain("alert");
  });
});

const DOCX_FIXTURE_BASE64 =
  "UEsDBBQAAAAIAGOrvFx5bjPX6AAAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QyU7DMBD9FWuuKHHggBCK0wPLETiUDxjZk8SqN3nc0v49Tlt6QIXjzFv1+tXeO7GjzDYGBbdtB4KCjsaGScHn+rV5AMEFg0EXAyk4EMNq6NeHRCyqNrCCuZT0KCXrmTxyGxOFiowxeyz1zJNMqDc4kbzrunupYygUSlMWDxj6Zxpx64p42df3qUcmxyCeTsQlSwGm5KzGUnG5C+ZXSnNOaKvyyOHZJr6pBJBXExbk74Cz7r0Ok60h8YG5vKGvLPkVs5Em6q2vyvZ/mys94zhaTRf94pZy1MRcF/euvSAebfjpL49zD99QSwMEFAAAAAgAY6u8XJv9N+qtAAAAKQEAAAsAAABfcmVscy8ucmVsc43POw7CMAwG4KtE3mlaBoRQ0y4IqSsqB7ASN61oHkrCo7cnAwNFDIy2f3+W6/ZpZnanECdnBVRFCYysdGqyWsClP232wGJCq3B2lgQsFKFt6jPNmPJKHCcfWTZsFDCm5A+cRzmSwVg4TzZPBhcMplwGzT3KK2ri27Lc8fBpwNpknRIQOlUB6xdP/9huGCZJRydvhmz6ceIrkWUMmpKAhwuKq3e7yCzwpuarF5sXUEsDBBQAAAAIAGOrvFxyXt/cxwAAAA0BAAARAAAAd29yZC9kb2N1bWVudC54bWxFj01rwzAMQP+K8H1xtkMZIUkpG+txY2ywq2YrrcGWjO027b+f3R52eUIfPEnj9hI8nCllJzypx65XQGzEOj5M6vvr7eFZQS7IFr0wTepKWW3ncR2smFMgLlAFnId1UsdS4qB1NkcKmDuJxLW3SApYapoOepVkYxJDOVd/8Pqp7zc6oGPVlL9iry3GhtRQ5g/xrjiD8Pr+8gMRE8Lnbg9GAhS6FIF8Wpxx9RC6d2sxoUGpI7w4PJPvRt1MjenGeON9m/7/ZP4DUEsBAhQAFAAAAAgAY6u8XHluM9foAAAArQEAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAUAAAACABjq7xcm/036q0AAAApAQAACwAAAAAAAAAAAAAAgAEZAQAAX3JlbHMvLnJlbHNQSwECFAAUAAAACABjq7xccl7f3McAAAANAQAAEQAAAAAAAAAAAAAAgAHvAQAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAMAAwC5AAAA5QIAAAAA";

const XLSX_FIXTURE_BASE64 =
  "UEsDBBQAAAAIAKurvFxuYbgN/gAAAC0CAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbK2RzU7DMBCEX8XytYqdckAIJe2BnyNwKA+w2JvEiv/kdUv69jhp4YAKXDit7JnZb2Q328lZdsBEJviWr0XNGXoVtPF9y193j9UNZ5TBa7DBY8uPSHy7aXbHiMRK1lPLh5zjrZSkBnRAIkT0RelCcpDLMfUyghqhR3lV19dSBZ/R5yrPO/imuccO9jazh6lcn3oktMTZ3ck4s1oOMVqjIBddHrz+RqnOBFGSi4cGE2lVDFxeJMzKz4Bz7rk8TDIa2Quk/ASuuORk5XtI41sIo/h9yYWWoeuMQh3U3pWIoJgQNA2I2VmxTOHA+NXf/MVMchnrfy7ytf+zh1y+e/MBUEsDBBQAAAAIAKurvFyY2uuLrgAAACcBAAALAAAAX3JlbHMvLnJlbHONz8EOgjAMBuBXWXqXgQdjDIOLMeFq8AHmVgYB1mWbCm/vjmI8eGz69/vTsl7miT3Rh4GsgCLLgaFVpAdrBNzay+4ILERptZzIooAVA9RVecVJxnQS+sEFlgwbBPQxuhPnQfU4y5CRQ5s2HflZxjR6w51UozTI93l+4P7TgK3JGi3AN7oA1q4O/7Gp6waFZ1KPGW38UfGVSLL0BqOAZeIv8uOdaMwSCrwq+ebB6g1QSwMEFAAAAAgAq6u8XMIJvp65AAAAHAEAAA8AAAB4bC93b3JrYm9vay54bWyNj0kOwjAMRa8SeQ8pLBCq2rJBSGwRHCA0Lo1o7MoO0+0J056VJ/3v/6rVPQ7miqKBqYbZtACD1LIPdKrhsN9MlmA0OfJuYMIaHqiwaqoby/nIfDZZTlpDn9JYWqttj9HplEekfOlYokt5lJPVUdB57RFTHOy8KBY2ukDwcSjlHw/uutDimttLREofE8HBpRxe+zAqNNX7g36rIRdz6N2FXmEzyWu59RkUjJQhN7L1M7BNZX86+0NrnlBLAwQUAAAACACrq7xcWv2Ca7EAAAAoAQAAGgAAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzjc/JCsJADAbgVxlyt2k9iEinXkToVeoDDNN0oZ2Fybj07R08iAUPnkLyky+kPD7NLO4UeHRWQpHlIMhq1462l3Btzps9CI7Ktmp2liQsxHCsygvNKqYVHkbPIhmWJQwx+gMi64GM4sx5sinpXDAqpjb06JWeVE+4zfMdhm8D1qaoWwmhbgsQzeLpH9t13ajp5PTNkI0/TuDDhYkHophQFXqKEj4jxncpsqQCViWuPqxeUEsDBBQAAAAIAKurvFzVyKp52AAAAEIBAAAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sdY/BSgNBDIZfJczdztaDiMxOaRG9eBBXodcwm3YHZ5JlJrb17Z0WET14CckXvvDHrU45wYFKjcK9WS46A8RBxsj73ry9PlzdGqiKPGISpt58UjUr745S3utEpNB8rr2ZVOc7a2uYKGNdyEzcNjspGbWNZW/rXAjHi5STve66G5sxsvHuwu5R0bsiRygtR6Ph3KyXBrQ3kVNkGrQ0Hqt36gcqhxjEWfXOnpEN38rmP+VZUtQYELZPwxZmLAgv60cIkkHppAL1YxdDJFb6e9a2VK3+iml//vdfUEsBAhQAFAAAAAgAq6u8XG5huA3+AAAALQIAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAUAAAACACrq7xcmNrri64AAAAnAQAACwAAAAAAAAAAAAAAgAEvAQAAX3JlbHMvLnJlbHNQSwECFAAUAAAACACrq7xcwgm+nrkAAAAcAQAADwAAAAAAAAAAAAAAgAEGAgAAeGwvd29ya2Jvb2sueG1sUEsBAhQAFAAAAAgAq6u8XFr9gmuxAAAAKAEAABoAAAAAAAAAAAAAAIAB7AIAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsBAhQAFAAAAAgAq6u8XNXIqnnYAAAAQgEAABgAAAAAAAAAAAAAAIAB1QMAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbFBLBQYAAAAABQAFAEUBAADjBAAAAAA=";
