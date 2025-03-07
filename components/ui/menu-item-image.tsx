import Image from "next/image"

interface MenuItemImageProps {
  src: string
  alt: string
  width?: number
  height?: number
}

export function MenuItemImage({ src, alt, width = 200, height = 150 }: MenuItemImageProps) {
  // Si la imagen comienza con '/', asumimos que es una imagen local
  const imageSrc = src.startsWith("/") ? src : `/images/menu/${src}`

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden">
      <Image
        src={imageSrc || "/placeholder.svg"}
        alt={alt}
        width={width}
        height={height}
        className="object-cover"
        onError={(e) => {
          // Si la imagen falla, usar una imagen de placeholder
          const imgElement = e.target as HTMLImageElement
          imgElement.src = `/placeholder.svg?height=${height}&width=${width}`
        }}
      />
    </div>
  )
}