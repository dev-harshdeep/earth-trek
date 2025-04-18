from flask import Flask, render_template , jsonify ,send_from_directory
import os 
import csv
import logging

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')


@app.route('/explore')
def explore():
    return render_template('explore.html')


@app.route('/quiz')
def quiz():
    return render_template('quiz.html')



@app.route('/blog')
def blog():
    return render_template('blog.html')


@app.route('/game')
def game():
    return render_template('game.html')

@app.route('/api/textures')
def get_textures():
    folder_path = os.path.join(app.static_folder, 'output_images')
    files = os.listdir(folder_path)
    texture_files = [file for file in files if file.endswith('.png') and 'smudge_effect_year_' in file]
    return jsonify(texture_files)  # Return list of texture files as JSON

STATIC_FOLDER = os.path.join(app.root_path, 'static')

def get_articles_data(year):
    # Construct the path to the CSV file
    csv_file = os.path.join(STATIC_FOLDER, 'nature_articles', f'articles_{year}.csv')
    
    # Check if the file exists and log the process
    if not os.path.exists(csv_file):
        app.logger.warning(f"CSV file for {year} not found: {csv_file}")
        return []
    
    articles = []
    # Try to read the CSV file and log any potential errors
    try:
        with open(csv_file, 'r', newline='', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                articles.append(row)
    except Exception as e:
        app.logger.error(f"Error reading CSV file for {year}: {str(e)}")
        return []
    
    # Log how many articles were loaded
    app.logger.info(f"Loaded {len(articles)} articles for {year}")
    return articles


@app.route('/articles/<int:year>')
def articles(year):
    # Get the articles data for the given year
    articles = get_articles_data(year)
    # Render the HTML template with the articles data
    return render_template('articles.html', articles=articles, year=year)

# To serve images from the static folder
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(STATIC_FOLDER, filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)