# Roadmap: Menu de Contexto (Botão Direito) - ArchiDraw

Documento de planejamento e evolução dos recursos do menu de contexto (botão direito) para o **ArchiDraw**.

---

## 1. Produtividade & Edição de Canvas (Ações Essenciais)

### 1.1. Operações Básicas de Manipulação de Elementos
* ~~**1.1.1. Copiar e Recortar Elementos (`Copy`, `Cut`)**: Copia e recorta os elementos selecionados do canvas.~~
* ~~**1.1.2. Duplicar Elemento (`Duplicate`)**: Duplica a seleção com deslocamento (offset) rápido no canvas.~~
* ~~**1.1.3. Excluir Elemento (`Delete`)**: Remove os elementos selecionados do canvas.~~

### 1.2. Organização e Camadas (Z-Index)
* **1.2.1. Trazer para a Frente (`Bring to Front`)**: Move os elementos selecionados para o topo da pilha visual.
* **1.2.2. Enviar para o Fundo (`Send to Back`)**: Envia os elementos selecionados para o fundo da pilha visual.
* **1.2.3. Avançar / Recuar Camada (`Bring Forward / Send Backward`)**: Ajuste fino de ordenação entre elementos adjacentes.

### 1.3. Agrupamento e Estruturação
* **1.3.1. Agrupar Seleção (`Group`)**: Une dois ou mais elementos selecionados em um grupo editável.
* **1.3.2. Desagrupar (`Ungroup`)**: Dissolve o grupo selecionado mantendo os elementos individuais.

### 1.4. Trava e Ajustes Rápidos de Estilo
* **1.4.1. Bloquear / Desbloquear Elemento (`Lock / Unlock`)**: Impede movimentação, redimensionamento ou exclusão acidental de elementos-chave da arquitetura.
* **1.4.2. Copiar Estilo (`Copy Style`)**: Copia atributos visuais (cor de preenchimento, borda, fonte, estilo de linha).
* **1.4.3. Colar Estilo (`Paste Style`)**: Aplica os atributos visuais copiados em outros elementos selecionados.

---

## 2. Recursos Específicos para Arquitetura de Software

### 2.1. Análise de Conexões e Dependências
* **2.1.1. Destaque de Conexões e Dependências (`Highlight Dependencies`)**: Destaca visualmente todos os conectores de entrada (*Upstream*) e saída (*Downstream*) do componente selecionado, esmaecendo o restante do diagrama.

---

## 3. Developer Experience & Exportação Avançada

### 3.1. Copiar Recursos Visualizados
* **3.1.1. Copiar Imagem SVG para Clipboard (`Copy as SVG`)**: Copia o vetor SVG diretamente para a área de transferência para colagem rápida em PRs, Slack ou Notion.
* **3.1.2. Copiar Imagem PNG para Clipboard (`Copy as PNG`)**: Exporta a seleção renderizada como imagem bitmap em alta resolução no clipboard.

---

## 4. Ações no Canvas Vazio (Clique sem Elemento Selecionado)

### 4.1. Interações Globais
* **4.1.1. Colar no Cursor (`Paste Here`)**: Cola os elementos do clipboard no ponto exato do clique.
* **4.1.2. Resetar Zoom e Enquadrar (`Reset Zoom / Fit to View`)**: Ajusta o zoom e a câmera para exibir todo o diagrama.
* **4.1.3. Selecionar Tudo (`Select All`)**: Seleciona todos os elementos do canvas.

---