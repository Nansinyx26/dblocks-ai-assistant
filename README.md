# Dblocks AI Assistant 🤖

Assistente virtual inteligente com reconhecimento de voz para a plataforma Dblocks (powered by BIPES).

<<<<<<< HEAD
## 🚀 Funcionalidades

- 🎙️ **Reconhecimento de Voz**: Estilo WhatsApp - segure para falar
- 🔊 **Text-to-Speech**: Vozes premium da ElevenLabs (Rachel, Adam, Bella)
- 💬 **Chat Interativo**: Interface moderna e responsiva
- 📚 **Base de Conhecimento**: Responde sobre BIPES, sensores, blocos e educação
- 🎨 **Design Responsivo**: Funciona em celular, tablet e desktop

## 📋 Tecnologias

- HTML5
- CSS3 (Design System com variáveis CSS)
- JavaScript (ES6+)
- Web Speech API (Reconhecimento de voz)
- ElevenLabs API (Text-to-Speech)

## 🎯 Como Usar

1. Abra o `index.html` em um navegador moderno (Chrome ou Edge recomendados)
2. Clique no botão flutuante do assistente
3. **Segurar o microfone** para falar ou digitar sua pergunta
4. Receba respostas com áudio em português

## ⚠️ Importante

- Para o microfone funcionar, o site deve estar em **HTTPS** ou **localhost**
- Se testar localmente (file://), use um servidor como **Live Server** do VS Code
- Permita o acesso ao microfone quando o navegador solicitar

## 🎨 Personalização

Edite as vozes disponíveis em `main.js`:
```javascript
const availableVoices = [
    { name: "Rachel", id: "21m00Tcm4TlvDq8ikWAM" },
    { name: "Adam", id: "pNInz6obpgDQGcFmaJgB" },
    { name: "Bella", id: "EXAVITQu4vr4xnSDxMaL" }
];
```
=======
> [!IMPORTANT]
> **Limites de créditos do mês**: Se zerar, o áudio só renova no mês seguinte por motivo de usar conta gratuita do ElevenLabs.

## 🚀 Funcionalidades

- 🎙️ **Reconhecimento de Voz**: Segure o microfone para falar (Estilo WhatsApp).
- 🧩 **Criação de Circuitos**: Uso de blocos para criar circuitos de forma intuitiva.
- 🔊 **Text-to-Speech Ultra Rápido**: Vozes premium brasileiras usando o modelo **Flash v2.5**.
- 💾 **Persistência Local**: Histórico de conversa salvo automaticamente no navegador via **IndexedDB**.
- 👤 **Preferência de Voz**: Sua voz selecionada é salva para o próximo acesso.
- 💬 **Chat Interativo**: Interface moderna com tema Dark/Neon e bloqueio de inputs durante a fala.

## 📋 Tecnologias

- HTML5 & CSS3 (Glassmorphism + Neon Design)
- JavaScript (ES6+)
- **IndexedDB**: Banco de dados local para o histórico.
- **LocalStorage**: Salva sua preferência de voz.
- ElevenLabs API (Modelo Flash v2.5)

## 🎯 Como Usar

1. Abra o `index.html` no Chrome ou Edge.
2. Clique no ícone do Robô no canto inferior.
3. **Segure o microfone** para falar ou digite no campo de texto.
4. Escolha sua voz preferida no ícone de perfil no topo do chat.

## ⚠️ Configurações e Erros

- O site deve estar em **HTTPS** ou **localhost** para o microfone funcionar.
- Se o áudio parar de sair, verifique se atingiu o limite de caracteres gratuito no console (F12).
>>>>>>> d3191ad0d757e025b90402d309c631aadc38300c

## 📄 Licença

Desenvolvido para [Dblocks](https://dblocks.com.br/)
