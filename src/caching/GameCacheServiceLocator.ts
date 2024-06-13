import { GameCacheService } from './GameCacheService.js';
import { InMemoryGameCacheService } from './InMemoryGameCacheService.js';

export class GameCacheServiceLocator {
    private static service: GameCacheService;

    public static getService(): GameCacheService {
        if (!this.service) {
            this.service = new InMemoryGameCacheService();
        }
        return this.service;
    }

    public static setService(service: GameCacheService): void {
        this.service = service;
    }
}