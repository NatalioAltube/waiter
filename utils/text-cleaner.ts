export const prepareSpanishTTS = (text: string): string => {
    if (!text) return ""
  
    // Eliminar acentos y caracteres especiales para mejorar la pronunciación
    let preparedText = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  
    // Reemplazar ciertos caracteres para mejorar la pronunciación
    preparedText = preparedText.replace(/ñ/g, "ni")
    preparedText = preparedText.replace(/ü/g, "u")
    preparedText = preparedText.replace(/á/g, "a")
    preparedText = preparedText.replace(/é/g, "e")
    preparedText = preparedText.replace(/í/g, "i")
    preparedText = preparedText.replace(/ó/g, "o")
    preparedText = preparedText.replace(/ú/g, "u")
    preparedText = preparedText.replace(/ç/g, "c")
  
    return preparedText
  }
  
  export const cleanText = (text: string): string => {
    if (!text) return ""
  
    // Eliminar formatos markdown y caracteres especiales
    const cleanedText = text
      // Eliminar formatos markdown
      .replace(/\*\*(.*?)\*\*/g, "$1") // Negrita
      .replace(/\*(.*?)\*/g, "$1") // Cursiva
      .replace(/__(.*?)__/g, "$1") // Subrayado
      .replace(/_(.*?)_/g, "$1") // Cursiva alternativa
      .replace(/~~(.*?)~~/g, "$1") // Tachado
      .replace(/`(.*?)`/g, "$1") // Código
      .replace(/```(.*?)```/g, "$1") // Bloque de código
      .replace(/\[(.*?)\]$$(.*?)$$/g, "$1") // Enlaces
  
      // Eliminar caracteres especiales sueltos
      .replace(/[*_~`#]/g, "")
  
      // Eliminar saltos de línea y normalizar espacios
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  
    return cleanedText
  }
  
  