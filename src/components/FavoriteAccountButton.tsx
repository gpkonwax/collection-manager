import { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isFavorite, toggleFavorite, FAVORITES_CHANGED_EVENT } from '@/lib/favoriteAccounts';

interface FavoriteAccountButtonProps {
  account: string;
}

/**
 * Header button that stars/unstars the account currently being viewed.
 * Lives in the sticky header so it follows the scroll.
 */
export function FavoriteAccountButton({ account }: FavoriteAccountButtonProps) {
  const [fav, setFav] = useState(() => isFavorite(account));

  // Stay in sync with the shared favourites list (View Wallet stars, imports, JSON menu).
  useEffect(() => {
    setFav(isFavorite(account));
    const onFavChange = () => setFav(isFavorite(account));
    window.addEventListener(FAVORITES_CHANGED_EVENT, onFavChange);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, onFavChange);
  }, [account]);

  const handleToggleFav = useCallback(() => {
    toggleFavorite(account);
    setFav(isFavorite(account));
  }, [account]);

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleToggleFav}
      title={fav ? 'Remove this account from your favourites' : 'Add this account to your favourites'}
      aria-pressed={fav}
      className={`gap-2 whitespace-nowrap h-9 px-4 bg-cheese hover:bg-cheese/90 text-cheese-foreground font-semibold theme-bright-fill theme-bright-text ${fav ? '' : 'opacity-90'}`}
    >
      <Star className={`h-4 w-4 ${fav ? 'fill-current' : ''}`} />
      {fav ? 'Favourited' : 'Favourite this account'}
    </Button>
  );
}
