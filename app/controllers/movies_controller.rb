class MoviesController < ApplicationController

 	require 'oauth2'
 	require 'uri'
 	require 'sinatra'
 	require 'net/http'
 	require 'net/https'

  skip_before_filter :verify_authenticity_token

  # global variables
  @@client_id = 'dfab6ac8e7336923fe75d4e7aa48cd0d'
  @@client_secret = 'fd1f5a26c5d53e17f8ed38e1aa282a51'
  @@auth_url = 'https://cs3213.herokuapp.com'
  @@auth_path = '/oauth/token.json'

  def index

  end

  def sign_out
    cookies.delete :token
    cookies.delete :refresh_token
    #cookies['token'] = nil
    redirect_to :action => 'index'
    #redirect_to 'http://0.0.0.0:3000'
  end

  # redirect to movies@3213 to get authentication and code
	def sign_in
 		redirect_url = 'http://0.0.0.0:3000/movies/access_token'
   	url = 'https://cs3213.herokuapp.com/oauth/new?client_id=' + @@client_id + '&client_secret=' + @@client_secret + '&redirect_uri=' + redirect_url
   	redirect_to url
 	end

  def access_token

    # if correct request
    if params[:response_type] == 'code'

     	# code
     	@code = params[:code]	
     	# make http post request
     	# curl -X POST -d '' 'https://cs3213.herokuapp.com/oauth/token.json?client_id=***&client_secret=****&code=***'
     	uri = URI.parse(@@auth_url)
     	http = Net::HTTP.new(uri.host, uri.port)
     	http.use_ssl = true
     	data = 'client_id=' + @@client_id + '&client_secret=' + @@client_secret + '&code=' + params[:code]
     	headers = {
     	    'Content-Type' => 'application/x-www-form-urlencoded'
     	}
     	path = @@auth_path
     	# response
     	resp = http.post(path, data, headers)	
     	@msg = resp.message	
     	# check if request successes
     	if resp.kind_of? Net::HTTPSuccess	
     	  # get data
     	  data = JSON.parse(resp.body)
     	  token = data['access_token']
     	  refresh_token = data['refresh_token']	
     	  @res = token.html_safe	
     	  # store in session
        cookies[:token] = token
        cookies[:refresh_token] = refresh_token
     	  # redirect to home page
     	  redirect_to :action => 'index'
     	end	
    else
      	@msg = 'invalid request'
    end

  end

end
