declare module "*.glb" {
  const content: string;
  export default content;
}

declare module "*.gltf" {
  const content: string;
  export default content;
}

// Declaración global para el SDK de Simli
declare global {
  interface Window {
    Simil: any;
  }
}

export {};

  
  