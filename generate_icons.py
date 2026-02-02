from PIL import Image, ImageDraw
import os
import math

icons_dir = r"D:\WORKING\ScanVui\icons"
sizes = [16, 48, 128]

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    corner_radius = size // 4
    
    # Gradient background - vibrant purple to pink
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            # From #667eea (purple) to #f093fb (pink)
            r = int(102 + (240 - 102) * t)
            g = int(126 + (147 - 126) * t)
            b = int(234 + (251 - 234) * t)
            
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
    
    # Magnifying glass parameters
    glass_center_x = int(size * 0.38)
    glass_center_y = int(size * 0.38)
    glass_radius = int(size * 0.28)
    line_width = max(2, size // 12)
    
    # Glass circle (lens) - white fill
    draw.ellipse(
        [glass_center_x - glass_radius, glass_center_y - glass_radius,
         glass_center_x + glass_radius, glass_center_y + glass_radius],
        fill=(255, 255, 255, 255),
        outline=(255, 255, 255, 255),
        width=line_width
    )
    
    # Handle
    handle_start_x = glass_center_x + int(glass_radius * 0.7)
    handle_start_y = glass_center_y + int(glass_radius * 0.7)
    handle_end_x = int(size * 0.85)
    handle_end_y = int(size * 0.85)
    handle_width = max(3, size // 8)
    
    draw.line(
        [handle_start_x, handle_start_y, handle_end_x, handle_end_y],
        fill=(255, 255, 255, 255),
        width=handle_width
    )
    
    # Round end of handle
    handle_cap_radius = handle_width // 2
    draw.ellipse(
        [handle_end_x - handle_cap_radius, handle_end_y - handle_cap_radius,
         handle_end_x + handle_cap_radius, handle_end_y + handle_cap_radius],
        fill=(255, 255, 255, 255)
    )
    
    # Smiley face inside the lens
    face_color = (102, 126, 234, 255)  # Purple color matching gradient start
    
    # Eyes
    eye_radius = max(1, size // 20)
    eye_y = glass_center_y - int(glass_radius * 0.2)
    left_eye_x = glass_center_x - int(glass_radius * 0.35)
    right_eye_x = glass_center_x + int(glass_radius * 0.35)
    
    draw.ellipse(
        [left_eye_x - eye_radius, eye_y - eye_radius,
         left_eye_x + eye_radius, eye_y + eye_radius],
        fill=face_color
    )
    draw.ellipse(
        [right_eye_x - eye_radius, eye_y - eye_radius,
         right_eye_x + eye_radius, eye_y + eye_radius],
        fill=face_color
    )
    
    # Smile (arc)
    smile_width = int(glass_radius * 0.6)
    smile_height = int(glass_radius * 0.4)
    smile_y = glass_center_y + int(glass_radius * 0.1)
    smile_line_width = max(2, size // 20)
    
    draw.arc(
        [glass_center_x - smile_width // 2, smile_y - smile_height // 2,
         glass_center_x + smile_width // 2, smile_y + smile_height // 2 + smile_height],
        start=0, end=180,
        fill=face_color,
        width=smile_line_width
    )
    
    return img

for size in sizes:
    img = create_icon(size)
    output_path = os.path.join(icons_dir, f"icon{size}.png")
    img.save(output_path)
    print(f"Created: icon{size}.png")

print("Done! Smiley magnifying glass icons created.")
