'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, ShoppingCart, Star, GitCompareArrows } from 'lucide-react'
import { useCartDrawer } from '@/components/cart/CartDrawerProvider'
import { useAuth } from '@/hooks/useAuth'
import { useFavorites } from '@/components/favorites/FavoritesProvider'
import { useCompare } from '@/components/compare/CompareDrawerProvider'

interface ApiProductCardProps {
  id: string;
  name: string;
  price: number;
  discountPrice?: number;
  hasDiscount?: boolean;
  finalPrice?: number;
  discountPercentage?: number;
  quantityStatus?: number | string;
  quantity?: number;
  imageUrl?: string; // optional hardcoded image for demo data
}

export default function ApiProductCard({ 
  id, 
  name, 
  price,
  discountPrice,
  hasDiscount,
  finalPrice,
  discountPercentage,
  quantityStatus,
  quantity,
  imageUrl: providedImageUrl,
}: ApiProductCardProps) {
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [productRating, setProductRating] = useState<number>(0)
  const { addToCart, isInCart, openCart } = useCartDrawer()
  const { isAuthenticated } = useAuth()
  const { lists, isInFavorites, toggleFavorite, openPicker, picker, productToListId, ui } = useFavorites()
  const { has, toggle: toggleCompare, openCompare } = useCompare()

  const title = name || 'Без назви'
  const normalizedStatus = typeof quantityStatus === 'string' ? quantityStatus.toLowerCase() : ''
  const isReadyToShip = normalizedStatus.includes('готов') || normalizedStatus.includes('ready')
  
  type StockState = 'in' | 'low' | 'out'
  const stockState: StockState = (() => {
    if (typeof quantityStatus === 'number') {
      switch (quantityStatus) {
        case 3: return 'out' 
        case 2: return 'low' 
        case 1: return 'in'  
        case 0:
        default:
          if (typeof quantity === 'number') {
            if (quantity <= 0) return 'out'
            if (quantity <= 3) return 'low'
            return 'in'
          }
          return 'in'
      }
    }

    if (!quantityStatus) {
      if (typeof quantity === 'number') {
        if (quantity <= 0) return 'out'
        if (quantity <= 3) return 'low'
        return 'in'
      }
      return 'in'
    }

    if (normalizedStatus.includes('немає') || normalizedStatus.includes('відсут') || normalizedStatus.includes('out')) {
      return 'out'
    }
    if (
      normalizedStatus.includes('зік') ||
      normalizedStatus.includes('закінч') ||
      normalizedStatus.includes('low')
    ) {
      return 'low'
    }
    return 'in'
  })()

  const isAvailable = stockState !== 'out'
  const availabilityBadge = (() => {
    if (stockState === 'in') {
      return { text: 'В наявності', classes: 'bg-green-100 text-green-800' }
    }
    if (stockState === 'low') {
      return { text: 'Закінчується', classes: 'bg-orange-100 text-orange-800' }
    }
    return { text: 'Немає в наявності', classes: 'bg-red-100 text-red-800' }
  })()
 
  const primaryPrice = hasDiscount ? (finalPrice ?? discountPrice ?? price) : price
  const showOldPrice = Boolean(hasDiscount && price && primaryPrice && price > primaryPrice)
  const priceDisplay = `${Math.round(primaryPrice)} грн`

  useEffect(() => {
    async function fetchProductImage() {
      try {
        const response = await fetch(`/api/products/media/${id}`)
        if (response.ok) {
          const media = await response.json()
          type MediaItem = { url?: string; secondaryUrl?: string; order?: number; type?: 'image' | 'video' }
          const sortedMedia = (Array.isArray(media) ? media : []) as Array<MediaItem>
          sortedMedia.sort((a, b) => (a.order || 0) - (b.order || 0))
          const firstImage = sortedMedia.find((m) => (m.type || 'image') === 'image' && (m.url || m.secondaryUrl))
          if (firstImage) setResolvedImageUrl(firstImage.url || firstImage.secondaryUrl || '')
        }
      } catch (error) {
        console.error('Error fetching product image:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (providedImageUrl) {
      setResolvedImageUrl(providedImageUrl)
      setIsLoading(false)
      return
    }

    fetchProductImage()
  }, [id, providedImageUrl])

  // Load product rating
  useEffect(() => {
    async function loadProductRating() {
      try {
        const res = await fetch(`/api/products/reviews/${id}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const rating = typeof data?.averageRating === 'number' ? data.averageRating : 0
          setProductRating(rating)
        }
      } catch (error) {
        console.error('Error fetching product rating:', error)
        setProductRating(0)
      }
    }

    if (id) {
      loadProductRating()
    }
  }, [id])

  const inFav = isInFavorites(id)

  const StarBar = ({ value, size = 12 }: { value: number; size?: number }) => {
    const clamped = Math.max(0, Math.min(5, value))
    const full = Math.floor(clamped)
    const frac = clamped - full
    return (
      <div className="inline-flex items-center gap-0.5 align-middle" aria-label={`Рейтинг ${clamped.toFixed(1)} з 5`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const fillPct = i < full ? 100 : i === full ? Math.round(frac * 100) : 0
          return (
            <div key={i} className="relative" style={{ width: size, height: size }}>
              {/* Base outline */}
              <Star className="block text-gray-400" style={{ width: size, height: size }} strokeWidth={2} />
              {/* Colored fill clip */}
              {fillPct > 0 && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
                  <Star className="block text-[#4563d1] fill-current" style={{ width: size, height: size }} strokeWidth={0} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="group relative rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <button
        className={`absolute right-4 hover:cursor-pointer top-4 z-10 rounded-full p-1.5 ${inFav ? 'bg-[#4563d1]/10 text-[#4563d1]' : 'bg-white text-gray-400'} transition-colors hover:text-[#4563d1]`}
        aria-label={inFav ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(e) => {
          e.preventDefault()
          if (!isAuthenticated) { window.location.href = '/auth/login'; return }
          toggleFavorite(id)
        }}
      >
        <Heart className={`h-5 w-5 ${inFav ? 'fill-current' : ''}`} />
      </button>
      {/* Compare toggle button */}
      <button
        className={`absolute right-14 hover:cursor-pointer top-4 z-10 rounded-full p-1.5 ${has(id) ? 'bg-[#4563d1]/10 text-[#4563d1]' : 'bg-white text-gray-400'} transition-colors hover:text-[#4563d1]`}
        aria-label={has(id) ? 'Видалити з порівняння' : 'Додати до порівняння'}
        onClick={(e) => {
          e.preventDefault()
          const wasIn = has(id)
          toggleCompare(id)
          if (!wasIn) openCompare()
        }}
      >
        <GitCompareArrows className="h-5 w-5" />
      </button>
      
      <Link href={`/product/${id}`}>
        <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#4563d1]"></div>
            </div>
          ) : resolvedImageUrl ? (
            <Image
              src={resolvedImageUrl}
              alt={title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-200">
              <span className="text-gray-400">Немає фото</span>
            </div>
          )}
        </div>
        
        <h3 className="mb-2 line-clamp-2 min-h-[2.5rem] text-sm text-gray-700">
          {title}
        </h3>

        <div className="mb-2 flex items-center gap-2">
          <span 
            className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${availabilityBadge.classes}`}
          >
            {availabilityBadge.text}
          </span>
          <div className="flex items-center gap-1">
            <StarBar value={productRating} size={16} />
            <span className="text-xs text-gray-600">{productRating.toFixed(1)}</span>
          </div>
        </div>
        
        <div className="mb-2 flex items-baseline gap-2">
          <p className="text-[18px] md:text-lg font-semibold whitespace-nowrap">
            {priceDisplay}
          </p>
          {showOldPrice && (
            <span className="text-sm text-gray-400 line-through whitespace-nowrap">{Math.round(price)} грн</span>
          )}
          {hasDiscount && discountPercentage ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded bg-red-50 px-1 py-0.5 text-sm font-medium text-red-700 whitespace-nowrap">
              -{discountPercentage}%
            </span>
          ) : null}
        </div>
        
        
        {isReadyToShip && (
          <p className="mb-3 text-xs text-blue-600">
            Готовий до відправки
          </p>
        )}
      </Link>
      
      <button 
        className={`w-full hover:cursor-pointer rounded-full px-2 py-1.5 text-sm font-medium transition-colors ${isInCart(id) ? 'bg-white border border-[#4563d1] text-[#4563d1] hover:bg-[#4563d1]/5' : 'bg-[#4563d1] text-white hover:bg-[#364ea8]'} disabled:bg-gray-300`}
        disabled={!isAvailable}
        onClick={(e) => {
          e.preventDefault()
          if (isInCart(id)) { openCart(); return }
          addToCart(id, 1)
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          {isInCart(id) ? 'У кошику' : 'В кошик'}
        </div>
      </button>

      {/* Picker drawer & toast, rendered once globally; noop here */}
    </div>
  )
}