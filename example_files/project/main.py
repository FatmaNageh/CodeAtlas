import pygame
import random

# Initialize Pygame
pygame.init()

# Configuration
SCREEN_WIDTH, SCREEN_HEIGHT = 300, 600
BLOCK_SIZE = 30
COLUMNS, ROWS = SCREEN_WIDTH // BLOCK_SIZE, SCREEN_HEIGHT // BLOCK_SIZE
FPS = 60

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRAY = (40, 40, 40)
COLORS = [
    (0, 255, 255), (0, 0, 255), (255, 165, 0),
    (255, 255, 0), (0, 255, 0), (128, 0, 128), (255, 0, 0)
]

# Shape Definitions (coordinates in 4x4 bounding box)
SHAPES = [
    [[1, 5, 9, 13], [4, 5, 6, 7]], # I
    [[4, 5, 9, 10], [2, 6, 5, 9]], # Z
    [[6, 7, 9, 10], [1, 5, 6, 10]], # S
    [[1, 2, 5, 6]],                # O
    [[1, 5, 9, 10], [4, 5, 6, 2], [0, 1, 5, 9], [8, 4, 5, 6]], # L
    [[1, 5, 9, 8], [0, 4, 5, 6], [1, 2, 5, 9], [4, 5, 6, 10]], # J
    [[1, 4, 5, 6], [1, 5, 9, 6], [4, 5, 6, 9], [1, 4, 5, 9]]   # T
]

class Tetris:
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Simple Tetris")
        self.clock = pygame.time.Clock()
        self.grid = [[BLACK for _ in range(COLUMNS)] for _ in range(ROWS)]
        self.current_piece = self.new_piece()
        self.game_over = False
        self.score = 0

    def new_piece(self):
        shape = random.choice(SHAPES)
        return {"shape": shape, "rotation": 0, "color": random.choice(COLORS),
                "x": COLUMNS // 2 - 2, "y": 0}

    def get_piece_coords(self, piece):
        coords = []
        shape_format = piece["shape"][piece["rotation"] % len(piece["shape"])]
        for i in shape_format:
            coords.append((piece["x"] + (i % 4), piece["y"] + (i // 4)))
        return coords

    def is_valid(self, piece, dx=0, dy=0, dr=0):
        for x, y in self.get_piece_coords({**piece, "x": piece["x"] + dx, "y": piece["y"] + dy, "rotation": piece["rotation"] + dr}):
            if x < 0 or x >= COLUMNS or y >= ROWS: return False
            if y >= 0 and self.grid[y][x] != BLACK: return False
        return True

    def clear_lines(self):
        full_rows = [i for i, row in enumerate(self.grid) if all(col != BLACK for col in row)]
        for row in full_rows:
            del self.grid[row]
            self.grid.insert(0, [BLACK for _ in range(COLUMNS)])
            self.score += 10

    def run(self):
        drop_time = 0
        while not self.game_over:
            self.screen.fill(BLACK)
            dt = self.clock.tick(FPS)
            drop_time += dt

            # Automatic Fall
            if drop_time > 500:
                if self.is_valid(self.current_piece, dy=1):
                    self.current_piece["y"] += 1
                else:
                    for x, y in self.get_piece_coords(self.current_piece):
                        if y < 0: self.game_over = True
                        else: self.grid[y][x] = self.current_piece["color"]
                    self.clear_lines()
                    self.current_piece = self.new_piece()
                drop_time = 0

            # Events
            for event in pygame.event.get():
                if event.type == pygame.QUIT: self.game_over = True
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_LEFT and self.is_valid(self.current_piece, dx=-1):
                        self.current_piece["x"] -= 1
                    if event.key == pygame.K_RIGHT and self.is_valid(self.current_piece, dx=1):
                        self.current_piece["x"] += 1
                    if event.key == pygame.K_DOWN and self.is_valid(self.current_piece, dy=1):
                        self.current_piece["y"] += 1
                    if event.key == pygame.K_UP and self.is_valid(self.current_piece, dr=1):
                        self.current_piece["rotation"] += 1

            # Draw Grid
            for y, row in enumerate(self.grid):
                for x, color in enumerate(row):
                    pygame.draw.rect(self.screen, color, (x*BLOCK_SIZE, y*BLOCK_SIZE, BLOCK_SIZE-1, BLOCK_SIZE-1))

            # Draw Current Piece
            for x, y in self.get_piece_coords(self.current_piece):
                if y >= 0:
                    pygame.draw.rect(self.screen, self.current_piece["color"], (x*BLOCK_SIZE, y*BLOCK_SIZE, BLOCK_SIZE-1, BLOCK_SIZE-1))

            pygame.display.flip()

if __name__ == "__main__":
    Tetris().run()
    pygame.quit()
