from flask import Flask, render_template, request, redirect, url_for, session
import requests
import json

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # for session management

API_BASE_URL = 'http://api-uri/api/v1'

# Helper function for API calls
def api_call(method, endpoint, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    url = f"{API_BASE_URL}{endpoint}"
    response = requests.request(method, url, headers=headers, data=json.dumps(data) if data else None)
    return response.json()

@app.route('/')
def home():
    if 'token' not in session:
        return redirect(url_for('login'))
    return render_template('home.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = {
            'name': request.form['name'],
            'email': request.form['email'],
            'password': request.form['password']
        }
        response = api_call('POST', '/user/account', data)
        if response.get('success'):
            return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = {
            'email': request.form['email'],
            'password': request.form['password']
        }
        response = api_call('POST', '/user/sign-in', data)
        if response.get('token'):
            session['token'] = response['token']
            return redirect(url_for('home'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    api_call('POST', '/user/sign-out', token=session.get('token'))
    session.pop('token', None)
    return redirect(url_for('login'))

@app.route('/horses', methods=['GET', 'POST'])
def horses():
    if request.method == 'POST':
        data = {
            'name': request.form['name'],
            'colour': request.form['colour'],
            'birth_year': request.form['birth_year']
        }
        api_call('POST', '/horse/', data, token=session.get('token'))
    
    horses = api_call('GET', '/horse/', token=session.get('token'))
    return render_template('horses.html', horses=horses)

@app.route('/calendar', methods=['GET', 'POST'])
def calendar():
    if request.method == 'POST':
        data = {
            'title': request.form['title'],
            'start_time': request.form['start_time'],
            'end_time': request.form['end_time']
        }
        api_call('POST', '/calendar/', data, token=session.get('token'))
    
    events = api_call('GET', '/calendar/', token=session.get('token'))
    return render_template('calendar.html', events=events)

@app.route('/arenas', methods=['GET', 'POST'])
def arenas():
    if request.method == 'POST':
        data = {
            'name': request.form['name'],
            'description': request.form['description']
        }
        api_call('POST', '/arena/', data, token=session.get('token'))
    
    arenas = api_call('GET', '/arena/', token=session.get('token'))
    return render_template('arenas.html', arenas=arenas)

@app.route('/arena/<int:arena_id>', methods=['GET', 'POST'])
def arena(arena_id):
    if request.method == 'POST':
        data = {
            'name': request.form['name'],
            'description': request.form['description']
        }
        api_call('PUT', f'/arena/{arena_id}', data, token=session.get('token'))
    
    arena = api_call('GET', f'/arena/{arena_id}', token=session.get('token'))
    return render_template('arena_detail.html', arena=arena)

if __name__ == '__main__':
    app.run(debug=True)