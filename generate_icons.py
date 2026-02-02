from PIL import Image, ImageDraw
import os

icons_dir = r"D:\WORKING\Get-Form-Extension\icons"
sizes = [16, 48, 128]

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    corner_radius = size // 5
    
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            r = int(102 + (118 - 102) * t)
            g = int(126 + (75 - 126) * t)
            b = int(234 + (162 - 234) * t)
            
            in_rect = True
            if x < corner_radius and y < corner_radius:
                if (x - corner_radius) ** 2 + (y - corner_radius) ** 2 > corner_radius ** 2:
                    in_rect = False
            elif x >= size - corner_radius and y < corner_radius:
                if (x - (size - corner_radius)) ** 2 + (y - corner_radius) ** 2 > corner_radius ** 2:
                    in_rect = False
            elif x < corner_radius and y >= size - corner_radius:
                if (x - corner_radius) ** 2 + (y - (size - corner_radius)) ** 2 > corner_radius ** 2:
                    in_rect = False
            elif x >= size - corner_radius and y >= size - corner_radius:
                if (x - (size - corner_radius)) ** 2 + (y - (size - corner_radius)) ** 2 > corner_radius ** 2:
                    in_rect = False
            
            if in_rect:
                img.putpixel((x, y), (r, g, b, 255))
    
    margin = size // 6
    line_height = size // 10
    spacing = size // 8
    
    draw.rounded_rectangle(
        [margin, margin + spacing * 0, size - margin, margin + spacing * 0 + line_height],
        radius=line_height // 3,
        fill=(255, 255, 255, 255)
    )
    
    draw.rounded_rectangle(
        [margin, margin + spacing * 1.5, size - margin - size // 4, margin + spacing * 1.5 + line_height],
        radius=line_height // 3,
        fill=(255, 255, 255, 255)
    )
    
    draw.rounded_rectangle(
        [margin, margin + spacing * 3, size - margin - size // 6, margin + spacing * 3 + line_height],
        radius=line_height // 3,
        fill=(255, 255, 255, 255)
    )
    
    circle_center_x = size - margin - size // 8
    circle_center_y = size - margin - size // 6
    circle_radius = size // 8
    
    draw.ellipse(
        [circle_center_x - circle_radius, circle_center_y - circle_radius,
         circle_center_x + circle_radius, circle_center_y + circle_radius],
        outline=(255, 255, 255, 255),
        width=max(1, size // 32)
    )
    
    handle_length = size // 12
    draw.line(
        [circle_center_x + circle_radius * 0.7, circle_center_y + circle_radius * 0.7,
         circle_center_x + circle_radius * 0.7 + handle_length, circle_center_y + circle_radius * 0.7 + handle_length],
        fill=(255, 255, 255, 255),
        width=max(1, size // 32)
    )
    
    return img

for size in sizes:
    img = create_icon(size)
    output_path = os.path.join(icons_dir, f"icon{size}.png")
    img.save(output_path)
    print(f"Created: icon{size}.png")

print("Done!")
